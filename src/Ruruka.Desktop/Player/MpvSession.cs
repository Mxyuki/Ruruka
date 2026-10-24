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

/// <summary>Runs one mpv process and follows its playback through mpv's JSON IPC over a named pipe.</summary>
internal sealed class MpvSession
{
    private static readonly TimeSpan PipeConnectTimeout = TimeSpan.FromSeconds(15);

    // The UI turns progress into AniList profile updates, so a coarse pace is enough.
    internal static readonly TimeSpan ProgressInterval = TimeSpan.FromSeconds(15);

    private readonly PlaybackTarget _target;
    private readonly IBridgeEvents _events;
    private readonly Process _process;
    private readonly WatchTracker _tracker;
    private readonly string _pipeName = $"ruruka-mpv-{Guid.NewGuid():N}";
    private readonly Stopwatch _sinceProgress = new();
    private double _lastPosition;

    private MpvSession(string mpvPath, PlaybackTarget target, WatchTracker tracker, IBridgeEvents events)
    {
        _target = target;
        _tracker = tracker;
        _events = events;
        var startInfo = new ProcessStartInfo(mpvPath) { UseShellExecute = false };
        startInfo.ArgumentList.Add(IpcServerArgument(_pipeName));
        startInfo.ArgumentList.Add("--force-window=immediate");
        startInfo.ArgumentList.Add($"--title={target.Title} - Episode {target.Episode}");
        startInfo.ArgumentList.Add("--");
        startInfo.ArgumentList.Add(target.FilePath);
        _process = new Process { StartInfo = startInfo };
    }

    /// <summary>
    /// The mpv option that opens its IPC named pipe. mpv only treats the path as a pipe name when it
    /// starts with the full \\.\pipe\ prefix; otherwise the pipe gets a different name and nothing can connect.
    /// </summary>
    internal static string IpcServerArgument(string pipeName) => $@"--input-ipc-server=\\.\pipe\{pipeName}";

    /// <summary>Starts mpv and tracks it in the background until it exits.</summary>
    public static void Start(string mpvPath, PlaybackTarget target, WatchTracker tracker, IBridgeEvents events)
    {
        var session = new MpvSession(mpvPath, target, tracker, events);
        session._process.Start();
        events.Emit("player.started", new { target.MediaId, target.Episode });
        _ = session.TrackAsync();
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
            _events.Emit("player.closed", new { _target.MediaId, _target.Episode, _tracker.WatchedRatio });
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
        var writer = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true, NewLine = "\n" };
        await writer.WriteLineAsync("""{"command":["observe_property",1,"time-pos"]}""");
        await writer.WriteLineAsync("""{"command":["observe_property",2,"duration"]}""");

        using var reader = new StreamReader(pipe, Encoding.UTF8);
        while (await reader.ReadLineAsync() is { } line)
        {
            HandleMessage(line);
        }
    }

    private void HandleMessage(string line)
    {
        using var message = JsonDocument.Parse(line);
        var root = message.RootElement;
        if (!root.TryGetProperty("event", out var eventName) || eventName.GetString() != "property-change") return;
        if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Number) return;

        if (!root.TryGetProperty("name", out var propertyName)) return;
        switch (propertyName.GetString())
        {
            case "duration":
                _tracker.DurationSeconds = data.GetDouble();
                ReportProgress(_lastPosition, isForced: true);
                break;
            case "time-pos":
                var position = data.GetDouble();
                if (_tracker.RecordPosition(position))
                {
                    _events.Emit("player.watched", new EpisodeWatched(_target.MediaId, _target.Episode, _target.Title));
                }
                ReportProgress(position);
                break;
        }
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
