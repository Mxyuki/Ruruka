using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Bridge.Modules;

/// <param name="onChanged">Lets the window react to settings it owns, such as the interface scale.</param>
internal sealed class SettingsModule(SettingsStore settings, Action onChanged) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("settings.get", () => Task.FromResult(settings.Current.ToPublic()));
        router.Register<SettingsPatch, PublicSettings>("settings.update", patch =>
        {
            var updated = settings.Apply(patch).ToPublic();
            onChanged();
            return Task.FromResult(updated);
        });
    }
}
