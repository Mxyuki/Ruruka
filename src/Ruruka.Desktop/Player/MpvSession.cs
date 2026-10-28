using System.Diagnostics;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Player;

public sealed record PlaybackTarget(int MediaId, int Episode, string FilePath, string Title);

/// <summary>Payload of "player.watched": the episode crossed the watched threshold.</summary>
public sealed record EpisodeWatched(int MediaId, int Episode, string Title);

/// <summary>Payload of "player.progress": where playback is, sent at most every <see cref="MpvSession.ProgressInterval"/>.</summary>
public sealed record PlaybackProgress(int MediaId, int Episode, double PositionSeconds, double DurationSeconds);

/// <summary>
/// Runs one mpv process and follows its playback through mpv's JSON IPC over a named pipe.
/// Another episode can be loaded into the same window with <see cref="TryLoadAsync"/>.
/// </summary>
internal sealed class MpvSession
{
    private static readonly TimeSpan PipeConnectTimeout = TimeSpan.FromSeconds(15);

    // The UI turns progress into AniList profile updates, so a coarse pace is enough.
    internal static readonly TimeSpan ProgressInterval = TimeSpan.FromSeconds(15);

    private const int DurationRequestId = 1;

    private readonly IBridgeEvents _events;
    private readonly Process _process;
    private readonly string _pipeName = $"ruruka-mpv-{Guid.NewGuid():N}";
    private readonly Stopwatch _sinceProgress = new();

    // The pipe reader and bridge calls run on different threads; the episode state is swapped under this lock.
    private readonly object _gate = new();
    private readonly SemaphoreSlim _writeGate = new(1, 1);
    private StreamWriter? _writer;
    private bool _hasExited;
    private PlaybackTarget _target;
    private WatchTracker _tracker;
    private double _lastPosition;
    private bool _hasReachedEnd;

    // Episodes sent with loadfile that mpv hasn't opened yet; until then, positions still belong to the previous file.
    private int _pendingLoads;

    private MpvSession(string mpvPath, PlaybackTarget target, WatchTracker tracker, IBridgeEvents events, bool isKeptOpen)
    {
        _target = target;
        _tracker = tracker;
        _events = events;
        var startInfo = new ProcessStartInfo(mpvPath) { UseShellExecute = false };
        startInfo.ArgumentList.Add(IpcServerArgument(_pipeName));
        startInfo.ArgumentList.Add("--force-window=immediate");
        if (isKeptOpen) startInfo.ArgumentList.Add("--keep-open=yes");
        startInfo.ArgumentList.Add($"--title={WindowTitle(target)}");
        startInfo.ArgumentList.Add("--");
        startInfo.ArgumentList.Add(target.FilePath);
        _process = new Process { StartInfo = startInfo };
    }

    /// <summary>
    /// The mpv option that opens its IPC named pipe. mpv only treats the path as a pipe name when it
    /// starts with the full \\.\pipe\ prefix; otherwise the pipe gets a different name and nothing can connect.
    /// </summary>
    internal static string IpcServerArgument(string pipeName) => $@"--input-ipc-server=\\.\pipe\{pipeName}";

    private static string WindowTitle(PlaybackTarget target) => $"{target.Title} - Episode {target.Episode}";

    /// <summary>Starts mpv and tracks it in the background until it exits.</summary>
    /// <param name="isKeptOpen">mpv stays on the last frame instead of quitting when the episode ends.</param>
    public static MpvSession Start(string mpvPath, PlaybackTarget target, WatchTracker tracker, IBridgeEvents events, bool isKeptOpen)
    {
        var session = new MpvSession(mpvPath, target, tracker, events, isKeptOpen);
        session._process.Start();
        events.Emit("player.started", new { target.MediaId, target.Episode });
        _ = session.TrackAsync();
        return session;
    }

    /// <summary>Plays another episode in this mpv window; false when mpv is gone or its pipe isn't connected yet.</summary>
    public async Task<bool> TryLoadAsync(PlaybackTarget target, WatchTracker tracker)
    {
        PlaybackTarget previousTarget;
        WatchTracker previousTracker;
        lock (_gate)
        {
            if (_hasExited || _writer is null) return false;
            (previousTarget, previousTracker) = (_target, _tracker);
            SwitchEpisode(target, tracker);
            _pendingLoads++;
        }

        // <-- La pause survit au changement de fichier, et mpv se met en pause à la fin d'un épisode gardé ouvert -->
        var isSent = await TrySendAsync("loadfile", target.FilePath, "replace")
            && await TrySendAsync("set_property", "title", WindowTitle(target))
            && await TrySendAsync("set_property", "pause", false);
        if (isSent)
        {
            _events.Emit("player.started", new { target.MediaId, target.Episode });
            return true;
        }

        lock (_gate)
        {
            SwitchEpisode(previousTarget, previousTracker);
            _pendingLoads--;
        }
        return false;
    }

    private void SwitchEpisode(PlaybackTarget target, WatchTracker tracker)
    {
        _target = target;
        _tracker = tracker;
        _lastPosition = 0;
        _hasReachedEnd = false;
        _sinceProgress.Reset();
    }

    private async Task TrackAsync()
    {
        try
        {
            await using var pipe = await ConnectAsync();
            if (pipe is not null) await ReadEventsAsync(pipe);
            await _process.WaitForExitAsync();
        }
        catch (Exception error) when (error is IOException or JsonException or InvalidOperationException)
        {
            Debug.WriteLine($"[mpv] tracking stopped: {error.Message}");
        }
        finally
        {
            lock (_gate)
            {
                _hasExited = true;
                _events.Emit("player.closed", new { _target.MediaId, _target.Episode, _tracker.WatchedRatio });
            }
            _process.Dispose();
        }
    }

    private async Task<NamedPipeClientStream?> ConnectAsync()
    {
        var deadline = DateTime.UtcNow + PipeConnectTimeout;
        while (DateTime.UtcNow < deadline && !_process.HasExited)
        {
            var pipe = new NamedPipeClientStream(".", _pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            try
            {
                await pipe.ConnectAsync(500);
                return pipe;
            }
            catch (TimeoutException)
            {
                await pipe.DisposeAsync();
            }
        }
        return null;
    }

    private async Task ReadEventsAsync(NamedPipeClientStream pipe)
    {
        _writer = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true, NewLine = "\n" };
        await TrySendAsync("observe_property", 1, "time-pos");
        await TrySendAsync("observe_property", 2, "duration");
        await TrySendAsync("observe_property", 3, "eof-reached");

        using var reader = new StreamReader(pipe, Encoding.UTF8);
        while (await reader.ReadLineAsync() is { } line)
        {
            HandleMessage(line);
        }
    }

    private Task<bool> TrySendAsync(params object[] command) => TrySendMessageAsync(new { command });

    private async Task<bool> TrySendMessageAsync(object message)
    {
        var json = JsonSerializer.Serialize(message);
        await _writeGate.WaitAsync();
        try
        {
            await _writer!.WriteLineAsync(json);
            return true;
        }
        catch (Exception error) when (error is IOException or ObjectDisposedException)
        {
            Debug.WriteLine($"[mpv] command not sent: {error.Message}");
            return false;
        }
        finally
        {
            _writeGate.Release();
        }
    }

    private void HandleMessage(string line)
    {
        using var message = JsonDocument.Parse(line);
        var root = message.RootElement;
        lock (_gate)
        {
            if (root.TryGetProperty("request_id", out var requestId))
            {
                var isDurationReply = requestId.GetInt32() == DurationRequestId && _pendingLoads == 0;
                if (isDurationReply && root.TryGetProperty("data", out var duration) && duration.ValueKind == JsonValueKind.Number)
                {
                    SetDuration(duration.GetDouble());
                }
                return;
            }
            if (!root.TryGetProperty("event", out var eventName)) return;
            switch (eventName.GetString())
            {
                case "file-loaded":
                    HandleFileLoaded();
                    break;
                case "property-change" when _pendingLoads == 0:
                    HandlePropertyChange(root);
                    break;
            }
        }
    }

    // mpv only reports a property when its value changes, so two episodes of the same length would leave the duration unknown.
    private void HandleFileLoaded()
    {
        if (_pendingLoads == 0) return;
        _pendingLoads--;
        if (_pendingLoads == 0) _ = TrySendMessageAsync(new { command = new object[] { "get_property", "duration" }, request_id = DurationRequestId });
    }

    private void HandlePropertyChange(JsonElement root)
    {
        if (!root.TryGetProperty("name", out var propertyName) || !root.TryGetProperty("data", out var data)) return;
        switch (propertyName.GetString())
        {
            case "duration" when data.ValueKind == JsonValueKind.Number:
                SetDuration(data.GetDouble());
                break;
            case "time-pos" when data.ValueKind == JsonValueKind.Number:
                RecordPosition(data.GetDouble());
                break;
            case "eof-reached" when data.ValueKind == JsonValueKind.True:
                ReportEnd();
                break;
        }
    }

    private void SetDuration(double durationSeconds)
    {
        _tracker.DurationSeconds = durationSeconds;
        ReportProgress(_lastPosition, isForced: true);
    }

    private void RecordPosition(double position)
    {
        if (_tracker.RecordPosition(position))
        {
            _events.Emit("player.watched", new EpisodeWatched(_target.MediaId, _target.Episode, _target.Title));
        }
        ReportProgress(position);
    }

    // With keep-open, mpv stays on the last frame, so the end of the episode is reported here rather than by "player.closed".
    private void ReportEnd()
    {
        if (_hasReachedEnd) return;
        _hasReachedEnd = true;
        _events.Emit("player.ended", new { _target.MediaId, _target.Episode });
    }

    // A known duration is sent at once, so the first profile update already shows it.
    private void ReportProgress(double position, bool isForced = false)
    {
        _lastPosition = position;
        if (!isForced && _sinceProgress.IsRunning && _sinceProgress.Elapsed < ProgressInterval) return;
        _sinceProgress.Restart();
        _events.Emit("player.progress", new PlaybackProgress(_target.MediaId, _target.Episode, position, _tracker.DurationSeconds));
    }
}
