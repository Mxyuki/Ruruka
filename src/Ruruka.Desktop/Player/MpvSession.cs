using System.Diagnostics;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Player;

/// <param name="CoverUrl">AniList cover shown on Discord; null keeps the Ruruka icon.</param>
public sealed record PlaybackTarget(int MediaId, int Episode, string FilePath, string Title, string? CoverUrl = null);

/// <summary>Payload of "player.watched": the episode crossed the watched threshold.</summary>
public sealed record EpisodeWatched(int MediaId, int Episode, string Title);

/// <summary>Payload of "player.progress": where playback is, sent at most every <see cref="MpvSession.ProgressInterval"/>.</summary>
public sealed record PlaybackProgress(int MediaId, int Episode, double PositionSeconds, double DurationSeconds);

/// <summary>Payload of "player.sync": the exact playback state, sent on pause, after a seek and every <see cref="MpvSession.SyncInterval"/>.</summary>
public sealed record PlaybackSyncPoint(int MediaId, int Episode, double PositionSeconds, double DurationSeconds, bool IsPaused);

/// <summary>Payload of "player.userControl": the person at this player paused or seeked, as opposed to a sync correction.</summary>
public sealed record PlaybackUserControl(int MediaId, int Episode, double? PositionSeconds, bool? IsPaused);

/// <summary>Told about one player's playback on mpv's own thread, so it must return at once.</summary>
public interface IPlaybackListener
{
    void OnPlaybackChanged(PlaybackTarget target, PlaybackSyncPoint point);

    void OnPlaybackClosed(PlaybackTarget target);
}

/// <summary>How to start mpv: which executable, and the bundled Ruruka config when it is the bundled player.</summary>
internal sealed record MpvLaunch(string ExecutablePath, string? ConfigDirectory)
{
    public bool IsBundled => ConfigDirectory is not null;
}

/// <summary>
/// Runs one mpv process and follows its playback through mpv's JSON IPC over a named pipe.
/// Another episode can be loaded into the same window with <see cref="TryLoadAsync"/>.
/// </summary>
internal sealed class MpvSession
{
    private static readonly TimeSpan PipeConnectTimeout = TimeSpan.FromSeconds(15);

    // The UI turns progress into AniList profile updates, so a coarse pace is enough.
    internal static readonly TimeSpan ProgressInterval = TimeSpan.FromSeconds(15);

    // A friend corrects against each point, so this is also how long a small drift can last.
    internal static readonly TimeSpan SyncInterval = TimeSpan.FromSeconds(5);

    // mpv pauses by itself on the last frame of a kept-open file; that isn't someone's decision.
    private const double EpisodeEndMarginSeconds = 2;

    private const int DurationRequestId = 1;
    private const int PositionRequestId = 2;

    private readonly IBridgeEvents _events;
    private readonly IPlaybackListener? _listener;
    private readonly Process _process;
    private readonly string _pipeName = $"ruruka-mpv-{Guid.NewGuid():N}";
    private readonly Stopwatch _sinceProgress = new();
    private readonly Stopwatch _sinceSync = new();

    // The pipe reader and bridge calls run on different threads; the episode state is swapped under this lock.
    private readonly object _gate = new();
    private readonly SemaphoreSlim _writeGate = new(1, 1);
    private StreamWriter? _writer;
    private bool _hasExited;
    private PlaybackTarget _target;
    private WatchTracker _tracker;
    private double _lastPosition;
    private bool _hasReachedEnd;
    private bool _isPaused;
    private bool _isPositionKnown;
    private double _appliedSpeed = 1;

    // Changes Ruruka asked for itself, so they aren't mistaken for the person's own and echoed back to the session.
    private bool? _expectedPause;
    private bool _isOwnSeekPending;
    private bool _isUserSeekPending;

    // The host's latest position during a synced session, applied once this mpv knows its own position.
    private (double PositionSeconds, bool IsPaused)? _hostPosition;

    // Episodes sent with loadfile that mpv hasn't opened yet; until then, positions still belong to the previous file.
    private int _pendingLoads;

    private MpvSession(MpvLaunch launch, PlaybackTarget target, WatchTracker tracker, IBridgeEvents events, IPlaybackListener? listener, bool isKeptOpen, IReadOnlyDictionary<string, string> options)
    {
        _target = target;
        _tracker = tracker;
        _events = events;
        _listener = listener;
        var startInfo = new ProcessStartInfo(launch.ExecutablePath) { UseShellExecute = false };
        startInfo.ArgumentList.Add(IpcServerArgument(_pipeName));
        if (launch.ConfigDirectory is not null) startInfo.ArgumentList.Add($"--config-dir={launch.ConfigDirectory}");
        startInfo.ArgumentList.Add("--force-window=immediate");
        if (isKeptOpen) startInfo.ArgumentList.Add("--keep-open=yes");
        startInfo.ArgumentList.Add($"--title={WindowTitle(target)}");
        startInfo.ArgumentList.Add($"--force-media-title={WindowTitle(target)}");
        foreach (var (name, value) in options) startInfo.ArgumentList.Add($"--{name}={value}");
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
    /// <param name="listener">Follows this window's playback, whichever episode it plays.</param>
    /// <param name="isKeptOpen">mpv stays on the last frame instead of quitting when the episode ends.</param>
    /// <param name="options">mpv options for this file, such as the cache of a stream.</param>
    public static MpvSession Start(MpvLaunch launch, PlaybackTarget target, WatchTracker tracker, IBridgeEvents events, IPlaybackListener? listener, bool isKeptOpen, IReadOnlyDictionary<string, string> options)
    {
        var session = new MpvSession(launch, target, tracker, events, listener, isKeptOpen, options);
        session._process.Start();
        events.Emit("player.started", new { target.MediaId, target.Episode });
        _ = session.TrackAsync();
        return session;
    }

    /// <summary>Plays another episode in this mpv window; false when mpv is gone or its pipe isn't connected yet.</summary>
    public async Task<bool> TryLoadAsync(PlaybackTarget target, WatchTracker tracker, IReadOnlyDictionary<string, string> options)
    {
        PlaybackTarget previousTarget;
        WatchTracker previousTracker;
        lock (_gate)
        {
            if (_hasExited || _writer is null) return false;
            (previousTarget, previousTracker) = (_target, _tracker);
            SwitchEpisode(target, tracker);
            _pendingLoads++;
            _isPaused = false;
        }

        // <-- La pause survit au changement de fichier, et mpv se met en pause à la fin d'un épisode gardé ouvert -->
        var isSent = true;
        foreach (var (name, value) in options) isSent = isSent && await TrySendAsync("set_property", name, value);
        isSent = isSent
            && await TrySendAsync("loadfile", target.FilePath, "replace")
            && await TrySendAsync("set_property", "title", WindowTitle(target))
            && await TrySendAsync("set_property", "force-media-title", WindowTitle(target))
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

    /// <summary>Follows the host of a synced session: the point waits here until this mpv reports where it is.</summary>
    public void FollowHost(double positionSeconds, bool isPaused)
    {
        lock (_gate)
        {
            if (_hasExited) return;
            _hostPosition = (positionSeconds, isPaused);
            if (_isPositionKnown) ApplyHostPosition();
        }
    }

    /// <summary>Applies a friend's pause or seek on the host's player; friends then follow its next sync point.</summary>
    public void ApplyControl(double? positionSeconds, bool? isPaused)
    {
        lock (_gate)
        {
            if (_hasExited || !_isPositionKnown) return;
            if (isPaused is { } pause) SetPause(pause);
            if (positionSeconds is { } position) SeekOwn(position);
        }
    }

    /// <summary>Stops following the host and returns to normal speed.</summary>
    public void ReleaseFromHost()
    {
        lock (_gate)
        {
            _hostPosition = null;
            if (_isPositionKnown) SetSpeed(1);
        }
    }

    private void ApplyHostPosition()
    {
        if (_hostPosition is not { } host) return;
        _hostPosition = null;
        SetPause(host.IsPaused);
        var correction = SyncCorrection.Decide(_lastPosition, host.PositionSeconds, host.IsPaused);
        SetSpeed(correction.Speed);
        if (correction.SeekToSeconds is { } seekTo) SeekOwn(seekTo);
    }

    private void SetPause(bool isPaused)
    {
        if (isPaused == _isPaused) return;
        _expectedPause = isPaused;
        _ = TrySendAsync("set_property", "pause", isPaused);
    }

    private void SeekOwn(double positionSeconds)
    {
        _isOwnSeekPending = true;
        _ = TrySendAsync("seek", positionSeconds, "absolute+exact");
    }

    private void SetSpeed(double speed)
    {
        if (Math.Abs(speed - _appliedSpeed) < 0.001) return;
        _appliedSpeed = speed;
        _ = TrySendAsync("set_property", "speed", speed);
    }

    private void SwitchEpisode(PlaybackTarget target, WatchTracker tracker)
    {
        _target = target;
        _tracker = tracker;
        _lastPosition = 0;
        _hasReachedEnd = false;
        _isPositionKnown = false;
        _expectedPause = null;
        _isOwnSeekPending = false;
        _isUserSeekPending = false;
        _sinceProgress.Reset();
        _sinceSync.Reset();
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
                _listener?.OnPlaybackClosed(_target);
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
        await TrySendAsync("observe_property", 4, "pause");

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
                HandleReply(requestId.GetInt32(), root);
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
                case "seek" when _pendingLoads == 0 && !_isOwnSeekPending:
                    _isUserSeekPending = true;
                    break;
                case "playback-restart" when _pendingLoads == 0:
                    _ = TrySendMessageAsync(new { command = new object[] { "get_property", "time-pos" }, request_id = PositionRequestId });
                    break;
            }
        }
    }

    private void HandleReply(int requestId, JsonElement root)
    {
        if (_pendingLoads > 0 || !root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Number) return;
        if (requestId == DurationRequestId) SetDuration(data.GetDouble());
        if (requestId == PositionRequestId) ReportPositionAfterSeek(data.GetDouble());
    }

    // <-- « time-pos » peut arriver après la reprise : on redemande la position pour que les amis reçoivent la bonne -->
    private void ReportPositionAfterSeek(double position)
    {
        _lastPosition = position;
        ReportSync();
        if (_isUserSeekPending) _events.Emit("player.userControl", new PlaybackUserControl(_target.MediaId, _target.Episode, position, null));
        _isUserSeekPending = false;
        _isOwnSeekPending = false;
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
            case "pause" when data.ValueKind is JsonValueKind.True or JsonValueKind.False:
                HandlePause(data.GetBoolean());
                break;
        }
    }

    private void HandlePause(bool isPaused)
    {
        var hasChanged = isPaused != _isPaused;
        var isOwnChange = _expectedPause == isPaused;
        var isAtEnd = _tracker.DurationSeconds > 0 && _tracker.DurationSeconds - _lastPosition < EpisodeEndMarginSeconds;
        _expectedPause = null;
        _isPaused = isPaused;
        ReportSync();
        if (hasChanged && !isOwnChange && !isAtEnd)
        {
            _events.Emit("player.userControl", new PlaybackUserControl(_target.MediaId, _target.Episode, null, isPaused));
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
        _isPositionKnown = true;
        ApplyHostPosition();
        if (!_sinceSync.IsRunning || _sinceSync.Elapsed >= SyncInterval) ReportSync();
    }

    private void ReportSync()
    {
        _sinceSync.Restart();
        var point = new PlaybackSyncPoint(_target.MediaId, _target.Episode, _lastPosition, _tracker.DurationSeconds, _isPaused);
        _events.Emit("player.sync", point);
        _listener?.OnPlaybackChanged(_target, point);
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
