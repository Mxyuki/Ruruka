using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Player;

public sealed record PlayerStatus(string? MpvPath, bool IsInstalled, bool IsBundledPlayerAvailable);

/// <param name="appBounds">Where the Ruruka window is, to open the player on the same monitor.</param>
public sealed class PlayerService(SettingsStore settings, IBridgeEvents events, IPlaybackListener bundledPlayerListener, Func<Rectangle> appBounds)
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

    /// <summary>The capture button of the bundled player was pressed. Raised on mpv's own thread, so handlers must return at once.</summary>
    internal event Action<MpvSession>? CaptureRequested;

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

    /// <summary>The monitors, for the settings page: the one the Ruruka window is on is marked.</summary>
    public IReadOnlyList<ScreenChoice> ListScreens()
    {
        var screens = Monitors();
        var appScreen = screens.Count > 0 ? PlayerWindowOptions.MostOverlapping(appBounds(), screens) : null;
        return screens.Select((screen, index) => new ScreenChoice(screen.Name, index + 1, screen.Bounds.Width, screen.Bounds.Height, screen.IsPrimary, screen == appScreen)).ToList();
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
        if (_session is { } open && await open.TryLoadAsync(target, tracker, open.Launch.IsBundled ? WithInterfaceOptions(options, current, target) : options)) return;

        var listener = launch.IsBundled ? bundledPlayerListener : null;
        var launchOptions = launch.IsBundled ? WithInterfaceOptions(options, current, target) : new Dictionary<string, string>(options);
        // <-- La place de la fenêtre ne se choisit qu'à l'ouverture : un épisode chargé dans la même fenêtre la garde -->
        if (launch.IsBundled) AddWindowPlace(launchOptions, current);
        var session = MpvSession.Start(launch, target, tracker, events, listener, current.IsPlayerKeptOpen, launchOptions);
        session.CaptureRequested += () => CaptureRequested?.Invoke(session);
        if (launch.IsBundled)
        {
            session.MonitorBounds = () => Monitors().Select(screen => screen.Bounds).ToList();
            session.Closed += () => SavePlacement(session.LastPlacement);
        }
        _session = session;
    }

    // <-- Le script du lecteur Ruruka lit ces options : au lancement, ou à chaque épisode chargé dans la même fenêtre -->
    private static Dictionary<string, string> WithInterfaceOptions(IReadOnlyDictionary<string, string> options, AppSettings current, PlaybackTarget target)
    {
        var navigation = target.Navigation ?? new EpisodeNavigation(null, null, null);
        return new(options) { ["script-opts"] = $"ruruka-capture={(current.IsCaptureEnabled ? "yes" : "no")},{navigation.ToScriptOptions()}" };
    }

    private void AddWindowPlace(Dictionary<string, string> options, AppSettings current)
    {
        var place = PlayerWindowOptions.Resolve(current.PlayerScreenMode, current.PlayerScreenName, current.PlayerWindow, Monitors(), appBounds());
        foreach (var (name, value) in place) options[name] = value;
    }

    private void SavePlacement(PlayerWindowPlacement? placement)
    {
        if (placement is not null && placement != settings.Current.PlayerWindow) settings.SavePlayerWindow(placement);
    }

    private static List<ScreenArea> Monitors() =>
        Screen.AllScreens.Select(screen => new ScreenArea(screen.DeviceName, screen.Bounds, screen.Primary)).ToList();

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
