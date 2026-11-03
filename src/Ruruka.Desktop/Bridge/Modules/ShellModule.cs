using System.Diagnostics;
using Ruruka.Desktop.Library;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class ShellModule(Form owner) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register<UrlParams, bool>("shell.openUrl", parameters => Run(() => OpenUrl(parameters.Url)));
        router.Register<PathParams, bool>("shell.openPath", parameters => Run(() => OpenPath(parameters.Path)));
        router.Register<DialogParams, string?>("shell.pickFolder", parameters => Task.FromResult(PickFolder(parameters.Title)));
        router.Register<DialogParams, string?>("shell.pickFile", parameters => Task.FromResult(PickFile(parameters.Title, parameters.Filter)));
        router.Register<ImageParams, bool>("shell.saveImage", parameters => SaveImageAsync(parameters.FileName, parameters.PngBase64));
    }

    private const int MaxImageBytes = 20 * 1024 * 1024;
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    /// <summary>Opens a web link in the default browser. Only http(s) is allowed so the UI can't launch programs.</summary>
    public static void OpenUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new BridgeException("Seuls les liens web peuvent être ouverts.");
        }
        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }

    /// <summary>Opens a folder in Explorer or a video in its default app. Anything else is refused so the UI can't launch programs.</summary>
    private static void OpenPath(string path)
    {
        var isOpenable = Directory.Exists(path) || (File.Exists(path) && LibraryScanner.IsVideo(path));
        if (!isOpenable) throw new BridgeException($"Impossible d'ouvrir : {path}");
        Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
    }

    private string? PickFolder(string? title)
    {
        using var dialog = new FolderBrowserDialog { Description = title ?? "Choose a folder", UseDescriptionForTitle = true };
        return dialog.ShowDialog(owner) == DialogResult.OK ? dialog.SelectedPath : null;
    }

    private string? PickFile(string? title, string? filter)
    {
        using var dialog = new OpenFileDialog { Title = title ?? "Choose a file", Filter = filter ?? "All files|*.*" };
        return dialog.ShowDialog(owner) == DialogResult.OK ? dialog.FileName : null;
    }

    /// <summary>Saves a PNG made by the UI (share cards) where the user picks. Only real PNG data is written.</summary>
    private async Task<bool> SaveImageAsync(string fileName, string pngBase64)
    {
        var bytes = DecodePng(pngBase64) ?? throw new BridgeException("Cette image n'est pas un PNG valide.");
        var safeName = string.Concat(fileName.Split(Path.GetInvalidFileNameChars())).Trim();
        using var dialog = new SaveFileDialog
        {
            Title = "Enregistrer l'image",
            Filter = "Image PNG|*.png",
            DefaultExt = "png",
            AddExtension = true,
            FileName = safeName.Length > 0 ? safeName : "ruruka.png",
        };
        if (dialog.ShowDialog(owner) != DialogResult.OK) return false;
        await File.WriteAllBytesAsync(dialog.FileName, bytes);
        return true;
    }

    private static byte[]? DecodePng(string base64)
    {
        if (base64.Length > MaxImageBytes / 3 * 4 + 4) return null;
        var buffer = new byte[base64.Length * 3 / 4];
        if (!Convert.TryFromBase64String(base64, buffer, out var length)) return null;
        var bytes = buffer[..length];
        return bytes.AsSpan().StartsWith(PngSignature) ? bytes : null;
    }

    private static Task<bool> Run(Action action)
    {
        action();
        return Task.FromResult(true);
    }

    private sealed record UrlParams(string Url);

    private sealed record PathParams(string Path);

    private sealed record DialogParams(string? Title, string? Filter);

    private sealed record ImageParams(string FileName, string PngBase64);
}
