using Ruruka.Desktop.Capture;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class CaptureModule(CaptureService capture, Form owner) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register<FrameParams, string?>("capture.getFrame", parameters => capture.ReadFrameAsync(parameters.WithSubtitles));
        router.Register<FrameAtParams, string?>("capture.getFrameAt", parameters => capture.ReadFrameAtAsync(parameters.Seconds, parameters.WithSubtitles));
        router.Register<ClipPreviewRequest, string?>("capture.previewClip", preview => capture.PreviewClipAsync(preview));
        router.Register<ClipRequest, ClipSaved?>("capture.saveClip", request => capture.SaveClipAsync(request, PickClipPath));
        router.Register("capture.cancelClip", () =>
        {
            capture.CancelClip();
            return Task.FromResult(true);
        });
        router.Register("capture.discard", () =>
        {
            capture.Discard();
            return Task.FromResult(true);
        });
    }

    private string? PickClipPath(string fileName, string extension)
    {
        var safeName = string.Concat(fileName.Split(Path.GetInvalidFileNameChars())).Trim();
        using var dialog = new SaveFileDialog
        {
            Title = "Enregistrer le clip",
            Filter = $"Vidéo {extension.ToUpperInvariant()}|*.{extension}",
            DefaultExt = extension,
            AddExtension = true,
            FileName = safeName.Length > 0 ? safeName : "ruruka",
        };
        return dialog.ShowDialog(owner) == DialogResult.OK ? dialog.FileName : null;
    }

    private sealed record FrameParams(bool WithSubtitles);

    private sealed record FrameAtParams(double Seconds, bool WithSubtitles);
}
