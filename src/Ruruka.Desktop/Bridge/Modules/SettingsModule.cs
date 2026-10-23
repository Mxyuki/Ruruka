using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Bridge.Modules;

/// <param name="onChanged">Lets the window react to settings it owns, such as the interface scale.</param>
internal sealed class SettingsModule(SettingsStore settings, Action onChanged) : IBridgeModule
{
    // mpv rarely reports the very last frame, so 100 % would never be reached.
    private const int MaxWatchPercent = 95;

    public void Register(BridgeRouter router)
    {
        router.Register("settings.get", () => Task.FromResult(settings.Current.ToPublic()));
        router.Register<SettingsPatch, PublicSettings>("settings.update", patch =>
        {
            Validate(patch);
            var updated = settings.Apply(patch).ToPublic();
            onChanged();
            return Task.FromResult(updated);
        });
    }

    private static void Validate(SettingsPatch patch)
    {
        if (patch.EpisodeCompletionPercent is < 50 or > MaxWatchPercent)
        {
            throw new BridgeException($"Un épisode compte comme vu entre 50 % et {MaxWatchPercent} %.");
        }
        if (patch.MinimumWatchedPercent is < 10 or > MaxWatchPercent)
        {
            throw new BridgeException($"Le temps vu minimum doit être entre 10 % et {MaxWatchPercent} %.");
        }
    }
}
