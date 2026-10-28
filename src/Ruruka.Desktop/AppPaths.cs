namespace Ruruka.Desktop;

internal static class AppPaths
{
    public static string RoamingData { get; } = Ensure(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Ruruka"));

    public static string LocalData { get; } = Ensure(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ruruka"));

    public static string SettingsFile => Path.Combine(RoamingData, "settings.json");

    public static string LibraryLinksFile => Path.Combine(RoamingData, "library-links.json");

    public static string WebViewData => Path.Combine(LocalData, "WebView2");

    public static string WebRoot => Path.Combine(AppContext.BaseDirectory, "wwwroot");

    private static string Ensure(string directory)
    {
        Directory.CreateDirectory(directory);
        return directory;
    }
}
