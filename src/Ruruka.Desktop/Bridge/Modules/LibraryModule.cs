using Ruruka.Desktop.Library;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class LibraryModule(SettingsStore settings, LinkStore links) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("library.scan", ScanAsync);
        router.Register("library.getLinks", () => Task.FromResult(links.GetAll()));
        router.Register<SetLinkParams, bool>("library.setLink", parameters =>
        {
            links.Set(parameters.FolderName, parameters.Link);
            return Task.FromResult(true);
        });
        router.Register<FolderParams, bool>("library.removeLink", parameters =>
        {
            links.Remove(parameters.FolderName);
            return Task.FromResult(true);
        });
    }

    private Task<IReadOnlyList<LibraryFolder>> ScanAsync()
    {
        var root = settings.Current.LibraryRoot;
        if (string.IsNullOrWhiteSpace(root)) return Task.FromResult<IReadOnlyList<LibraryFolder>>([]);
        return Task.Run(() => LibraryScanner.Scan(root));
    }

    private sealed record SetLinkParams(string FolderName, FolderLink Link);

    private sealed record FolderParams(string FolderName);
}
