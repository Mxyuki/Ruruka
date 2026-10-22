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
    }

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

    private static Task<bool> Run(Action action)
    {
        action();
        return Task.FromResult(true);
    }

    private sealed record UrlParams(string Url);

    private sealed record PathParams(string Path);

    private sealed record DialogParams(string? Title, string? Filter);
}
