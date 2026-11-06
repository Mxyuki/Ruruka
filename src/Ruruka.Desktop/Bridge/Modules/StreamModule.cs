using Ruruka.Desktop.Streaming;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class StreamModule(StreamService stream) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("stream.share", () => Task.FromResult(stream.Share()));
        router.Register("stream.stopSharing", () =>
        {
            stream.StopSharing();
            return Task.FromResult(true);
        });
        router.Register<OpenParams, bool>("stream.play", async parameters =>
        {
            await stream.PlayAsync(parameters.MediaId, parameters.Episode, parameters.Title, parameters.CoverUrl, parameters.FileSize, parameters.Extension);
            return true;
        });
        router.Register("stream.closeViewer", () =>
        {
            stream.CloseViewer();
            return Task.FromResult(true);
        });
    }

    private sealed record OpenParams(int MediaId, int Episode, string Title, string? CoverUrl, long FileSize, string Extension);
}
