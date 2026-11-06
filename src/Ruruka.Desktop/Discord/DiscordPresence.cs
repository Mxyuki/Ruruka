using System.Threading.Channels;
using Ruruka.Desktop.Player;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Discord;

/// <summary>
/// Shows the Ruruka player's episode on Discord. mpv's position updates drive it: one worker keeps
/// only the latest state, so a slow or absent Discord never holds up playback tracking.
/// </summary>
internal sealed class DiscordPresence : IPlaybackListener
{
    private const string ApplicationId = "1568045470675239012";

    // Discord allows 5 updates per 20 seconds.
    private static readonly TimeSpan MinUpdateInterval = TimeSpan.FromSeconds(4);

    // Playback wakes the worker every few seconds, so a Discord started later is found without polling.
    private static readonly TimeSpan ConnectRetryDelay = TimeSpan.FromSeconds(30);

    private readonly SettingsStore _settings;
    private readonly Channel<bool> _wakeUps = Channel.CreateBounded<bool>(new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });
    private readonly object _gate = new();
    private NowWatching? _watching;
    private DiscordIpcClient? _client;
    private DiscordActivity? _shown;
    private DateTimeOffset _nextConnectAt = DateTimeOffset.MinValue;

    public DiscordPresence(SettingsStore settings)
    {
        _settings = settings;
        _ = Task.Run(RunAsync);
    }

    public void OnPlaybackChanged(PlaybackTarget target, PlaybackSyncPoint point)
    {
        lock (_gate) _watching = new NowWatching(target.MediaId, target.Episode, target.Title, target.CoverUrl, point.PositionSeconds, point.DurationSeconds, point.IsPaused);
        Refresh();
    }

    public void OnPlaybackClosed(PlaybackTarget target)
    {
        lock (_gate)
        {
            if (_watching?.MediaId != target.MediaId || _watching.Episode != target.Episode) return;
            _watching = null;
        }
        Refresh();
    }

    /// <summary>Applies the current playback and setting right away, such as the toggle in Settings.</summary>
    public void Refresh() => _wakeUps.Writer.TryWrite(true);

    private async Task RunAsync()
    {
        await foreach (var _ in _wakeUps.Reader.ReadAllAsync())
        {
            var activity = CurrentActivity();
            if (activity is null)
            {
                await DisconnectAsync();
                _nextConnectAt = DateTimeOffset.MinValue;
                continue;
            }
            if (_client is not { IsOpen: true } && !await TryConnectAsync()) continue;
            if (activity.LooksLike(_shown)) continue;
            if (await _client!.TrySetActivityAsync(activity)) _shown = activity;
            await Task.Delay(MinUpdateInterval);
        }
    }

    private DiscordActivity? CurrentActivity()
    {
        if (!_settings.Current.IsDiscordPresenceShown) return null;
        lock (_gate) return _watching is { } watching ? DiscordActivity.From(watching, DateTimeOffset.UtcNow) : null;
    }

    private async Task<bool> TryConnectAsync()
    {
        await DisconnectAsync();
        if (DateTimeOffset.UtcNow < _nextConnectAt) return false;
        _nextConnectAt = DateTimeOffset.UtcNow + ConnectRetryDelay;
        _client = await DiscordIpcClient.ConnectAsync(ApplicationId);
        return _client is not null;
    }

    private async Task DisconnectAsync()
    {
        if (_client is not null) await _client.DisposeAsync();
        _client = null;
        _shown = null;
    }
}
