using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Player;

public sealed record PlayerStatus(string? MpvPath, bool IsInstalled, bool IsBundledPlayerAvailable);

public sealed class PlayerService(SettingsStore settings, IBridgeEvents events, IPlaybackListener bundledPlayerListener)
{
    // <-- Lecture à la demande pendant la séance : assez d'avance pour une coupure, rien d'écrit sur le disque de l'ami -->
    private static readonly Dictionary<string, string> StreamOptions = new()
    {
        ["cache"] = "yes",
        ["cache-on-disk"] = "no",
        ["demuxer-readahead-secs"] = "30",
        ["demuxer-max-bytes"] = "256MiB",
        ["force-seekable"] = "yes",
    };

    private static readonly Dictionary<string, string> NoOptions = [];

    private MpvSession? _session;

    /// <summary>The local file last opened in the player; null during a stream.</summary>
    public string? CurrentFilePath { get; private set; }

    public PlayerStatus Detect()
    {
        var configured = settings.Current.PlayerPath;
        var found = MpvLocator.Find(configured);
        if (found is not null && found != configured) settings.Apply(new SettingsPatch { PlayerPath = found });
        return new PlayerStatus(found, found is not null, BundledPlayer.IsAvailable);
    }

    public void SetPlayerPath(string path)
    {
        if (!MpvLocator.IsMpv(path)) throw new BridgeException("Choisis le fichier mpv.exe.");
        settings.Apply(new SettingsPatch { PlayerPath = path });
    }

    public async Task PlayAsync(PlaybackTarget target)
    {
        if (!File.Exists(target.FilePath)) throw new BridgeException($"Fichier de l'épisode introuvable : {target.FilePath}");
        await StartAsync(target, NoOptions, target.FilePath);
    }

    /// <summary>Plays a stream served on this PC; <paramref name="target"/> holds its local address as file path.</summary>
    public async Task PlayStreamAsync(PlaybackTarget target)
    {
        await StartAsync(target, StreamOptions, null);
    }

    public void FollowHost(double positionSeconds, bool isPaused) => _session?.FollowHost(positionSeconds, isPaused);

    public void ReleaseFromHost() => _session?.ReleaseFromHost();

    public void ApplyControl(double? positionSeconds, bool? isPaused) => _session?.ApplyControl(positionSeconds, isPaused);

    private async Task StartAsync(PlaybackTarget target, IReadOnlyDictionary<string, string> options, string? localFilePath)
    {
        var launch = ChooseLaunch();
        var current = settings.Current;

        // <-- Avant le lancement : « player.started » part de là, et l'interface partage aussitôt ce fichier -->
        CurrentFilePath = localFilePath;
        var tracker = new WatchTracker(current.EpisodeCompletionPercent / 100.0, current.MinimumWatchedPercent / 100.0);

        // <-- Une fenêtre mpv déjà ouverte reçoit le nouvel épisode : un partage d'écran Discord continue sans coupure -->
        if (_session is { } open && await open.TryLoadAsync(target, tracker, options)) return;
        var listener = launch.IsBundled ? bundledPlayerListener : null;
        _session = MpvSession.Start(launch, target, tracker, events, listener, current.IsPlayerKeptOpen, options);
    }

    // <-- Un choix impossible à honorer retombe sur l'autre lecteur plutôt que de bloquer l'épisode -->
    private MpvLaunch ChooseLaunch()
    {
        var current = settings.Current;
        var bundled = new MpvLaunch(BundledPlayer.ExecutablePath, BundledPlayer.ConfigDirectory);
        var isBundledChosen = PlayerChoice.Resolve(current.PlayerKind, current.PlayerPath) == PlayerChoice.Ruruka;
        if (isBundledChosen && BundledPlayer.IsAvailable) return bundled;
        if (MpvLocator.Find(current.PlayerPath) is { } ownMpv) return new MpvLaunch(ownMpv, null);
        if (BundledPlayer.IsAvailable) return bundled;
        throw new BridgeException("Aucun lecteur trouvé : le lecteur Ruruka manque et mpv n'est pas installé.");
    }
}
