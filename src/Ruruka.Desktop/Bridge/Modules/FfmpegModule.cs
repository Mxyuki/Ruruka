using Ruruka.Desktop.Capture;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class FfmpegModule(FfmpegService ffmpeg, IBridgeEvents events) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("ffmpeg.status", () => Task.FromResult(new FfmpegStatus(FfmpegService.IsInstalled, ffmpeg.IsInstalling)));
        router.Register("ffmpeg.install", async () =>
        {
            await ffmpeg.InstallAsync(ratio => events.Emit("ffmpeg.progress", new { ratio }));
            return true;
        });
        router.Register("ffmpeg.cancelInstall", () =>
        {
            ffmpeg.CancelInstall();
            return Task.FromResult(true);
        });
        router.Register("ffmpeg.remove", () =>
        {
            FfmpegService.Remove();
            return Task.FromResult(true);
        });
        router.Register("ffmpeg.takeInstallRequest", () => Task.FromResult(FfmpegService.TakeInstallRequest()));
    }

    private sealed record FfmpegStatus(bool IsInstalled, bool IsInstalling);
}
