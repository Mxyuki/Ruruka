using Ruruka.Desktop.Updates;

namespace Ruruka.Desktop.Bridge.Modules;

/// <param name="onInstallerReady">Quits the app so the downloaded installer can replace it.</param>
internal sealed class UpdateModule(UpdateService updates, Action<string> onInstallerReady) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("update.check", updates.CheckAsync);
        router.Register("update.install", async () =>
        {
            onInstallerReady(await updates.DownloadInstallerAsync());
            return true;
        });
    }
}
