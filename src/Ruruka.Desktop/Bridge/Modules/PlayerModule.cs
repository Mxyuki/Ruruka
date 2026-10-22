using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class PlayerModule(PlayerService player) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("player.detect", () => Task.FromResult(player.Detect()));
        router.Register<PathParams, bool>("player.setPath", parameters =>
        {
            player.SetPlayerPath(parameters.Path);
            return Task.FromResult(true);
        });
        router.Register<PlaybackTarget, bool>("player.play", target =>
        {
            player.Play(target);
            return Task.FromResult(true);
        });
    }

    private sealed record PathParams(string Path);
}
