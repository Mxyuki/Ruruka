using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Player;

public sealed record PlayerStatus(string? MpvPath, bool IsInstalled);

public sealed class PlayerService(SettingsStore settings, IBridgeEvents events)
{
    public PlayerStatus Detect()
    {
        var configured = settings.Current.PlayerPath;
        var found = MpvLocator.Find(configured);
        if (found is not null && found != configured) settings.Apply(new SettingsPatch { PlayerPath = found });
        return new PlayerStatus(found, found is not null);
    }

    public void SetPlayerPath(string path)
    {
        if (!MpvLocator.IsMpv(path)) throw new BridgeException("Choisis le fichier mpv.exe.");
        settings.Apply(new SettingsPatch { PlayerPath = path });
    }

    public void Play(PlaybackTarget target)
    {
        if (!File.Exists(target.FilePath)) throw new BridgeException($"Fichier de l'épisode introuvable : {target.FilePath}");
        var mpv = MpvLocator.Find(settings.Current.PlayerPath)
            ?? throw new BridgeException("mpv n'est pas installé. Installe-le pour lancer les épisodes depuis Ruruka.");
        var current = settings.Current;
        var tracker = new WatchTracker(current.EpisodeCompletionPercent / 100.0, current.MinimumWatchedPercent / 100.0);
        MpvSession.Start(mpv, target, tracker, events);
    }
}
