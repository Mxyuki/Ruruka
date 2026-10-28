using Ruruka.Desktop.Manga;

namespace Ruruka.Desktop.Bridge.Modules;

public sealed record MangaRequest(string Path);

internal sealed class MangaModule(MangaSiteClient client) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register<MangaRequest, object>("manga.get", async request => await client.GetAsync(request.Path));
    }
}
