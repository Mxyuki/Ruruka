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
        router.Register<PlaybackTarget, bool>("player.play", async target =>
        {
            await player.PlayAsync(target);
            return true;
        });
        router.Register<SyncPoint, bool>("player.followHost", point =>
        {
            player.FollowHost(point.PositionSeconds, point.IsPaused);
            return Task.FromResult(true);
        });
        router.Register("player.releaseFromHost", () =>
        {
            player.ReleaseFromHost();
            return Task.FromResult(true);
        });
    }

    private sealed record PathParams(string Path);

    private sealed record SyncPoint(double PositionSeconds, bool IsPaused);
}
