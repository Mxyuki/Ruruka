namespace Ruruka.Desktop;

internal static class AppPaths
{
    /// <summary>Set RURUKA_DEV_INSTANCE to run a second copy with its own data, to try a group watch alone on one PC.</summary>
    public static string DevInstanceSuffix { get; } = Environment.GetEnvironmentVariable("RURUKA_DEV_INSTANCE") is { Length: > 0 } instance ? $"-{instance}" : "";

    public static string RoamingData { get; } = Ensure(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Ruruka" + DevInstanceSuffix));

    public static string LocalData { get; } = Ensure(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ruruka" + DevInstanceSuffix));

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
