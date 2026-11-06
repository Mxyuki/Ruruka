using System.Threading.Channels;
using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Player;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Discord;

/// <summary>
/// Shows the Ruruka player's episode and the hosted session on Discord, and receives accepted invitations.
/// mpv's position updates drive it: one worker keeps only the latest state, so a slow or absent Discord
/// never holds up playback tracking.
/// </summary>
internal sealed class DiscordPresence : IPlaybackListener
{
    internal const string ApplicationId = "1568045470675239012";

    // Discord allows 5 updates per 20 seconds.
    private static readonly TimeSpan MinUpdateInterval = TimeSpan.FromSeconds(4);

    // Playback wakes the worker every few seconds, so a Discord started later is found without polling.
    // Without playback, Discord itself restarts the search by launching Ruruka for an invitation.
    private static readonly TimeSpan ConnectRetryDelay = TimeSpan.FromSeconds(30);

    private readonly SettingsStore _settings;
    private readonly IBridgeEvents _events;
    private readonly Action _onJoinRequested;
    private readonly Channel<bool> _wakeUps = Channel.CreateBounded<bool>(new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });
    private readonly object _gate = new();
    private NowWatching? _watching;
    private SessionInvite? _invite;
    private string? _companions;
    private SessionEpisode? _sessionEpisode;
    private string? _joinCode;
    private volatile bool _isConnectDue;
    private DiscordIpcClient? _client;
    private DiscordActivity? _shown;
    private DateTimeOffset _nextConnectAt = DateTimeOffset.MinValue;

    /// <param name="onJoinRequested">Called on a background thread when an invitation was accepted on this PC.</param>
    public DiscordPresence(SettingsStore settings, IBridgeEvents events, Action onJoinRequested)
    {
        _settings = settings;
        _events = events;
        _onJoinRequested = onJoinRequested;
        _ = Task.Run(RunAsync);
        Refresh();
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

    /// <summary>The session this PC is in: the invitation when it hosts, the others to name on hover, and the episode a friend follows.</summary>
    public void SetSession(SessionInvite? invite, IReadOnlyList<string> companionNames, SessionEpisode? sessionEpisode)
    {
        lock (_gate)
        {
            _invite = invite;
            _sessionEpisode = sessionEpisode;
            _companions = DiscordActivity.DescribeCompanions(companionNames);
        }
        Refresh();
    }

    /// <summary>The code of an invitation waiting for the UI, once.</summary>
    public string? TakeJoinCode()
    {
        lock (_gate)
        {
            var code = _joinCode;
            _joinCode = null;
            return code;
        }
    }

    /// <summary>Accepts someone who asked to join from Discord; false when Discord is unreachable.</summary>
    public async Task<bool> TryAcceptJoinAsync(string userId) =>
        _client is { IsOpen: true } client && await client.TryAcceptJoinAsync(userId);

    /// <summary>Discord launched Ruruka for an invitation: looks for it at once, whatever the last attempt.</summary>
    public void ConnectNow()
    {
        _isConnectDue = true;
        Refresh();
    }

    /// <summary>Applies the current playback and setting right away, such as the toggle in Settings.</summary>
    public void Refresh() => _wakeUps.Writer.TryWrite(true);

    private async Task RunAsync()
    {
        await foreach (var _ in _wakeUps.Reader.ReadAllAsync())
        {
            if (!_settings.Current.IsDiscordPresenceShown)
            {
                await DisconnectAsync();
                _nextConnectAt = DateTimeOffset.MinValue;
                continue;
            }
            if (_client is not { IsOpen: true } && !await TryConnectAsync()) continue;
            var activity = CurrentActivity();
            if (activity is null ? _shown is null : activity.LooksLike(_shown)) continue;
            var isSent = await (activity is null ? _client!.TryClearActivityAsync() : _client!.TrySetActivityAsync(activity));
            if (isSent) _shown = activity;
            await Task.Delay(MinUpdateInterval);
        }
    }

    private DiscordActivity? CurrentActivity()
    {
        lock (_gate) return DiscordActivity.ForNow(_watching ?? _sessionEpisode?.ToNowWatching(), _invite, _companions, DateTimeOffset.UtcNow);
    }

    private async Task<bool> TryConnectAsync()
    {
        await DisconnectAsync();
        if (!_isConnectDue && DateTimeOffset.UtcNow < _nextConnectAt) return false;
        _isConnectDue = false;
        _nextConnectAt = DateTimeOffset.UtcNow + ConnectRetryDelay;
        _client = await DiscordIpcClient.ConnectAsync(ApplicationId, HandleJoin, asked => _events.Emit("discord.joinAsked", asked));
        return _client is not null;
    }

    // <-- L'interface vient chercher le code : au démarrage, elle n'écoute pas encore quand Discord l'envoie -->
    private void HandleJoin(string code)
    {
        lock (_gate) _joinCode = code;
        _onJoinRequested();
        _events.Emit("discord.joinRequested", new { });
    }

    private async Task DisconnectAsync()
    {
        if (_client is not null) await _client.DisposeAsync();
        _client = null;
        _shown = null;
    }
}
