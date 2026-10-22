namespace Ruruka.Desktop.Player;

internal static class MpvLocator
{
    private const string Executable = "mpv.exe";

    /// <summary>Returns the configured mpv if it still exists, otherwise the first install found on this machine.</summary>
    public static string? Find(string? configuredPath)
    {
        if (IsMpv(configuredPath)) return configuredPath;
        return SearchPath() ?? KnownLocations().FirstOrDefault(File.Exists);
    }

    public static bool IsMpv(string? path) =>
        !string.IsNullOrWhiteSpace(path)
        && File.Exists(path)
        && Path.GetFileName(path).Equals(Executable, StringComparison.OrdinalIgnoreCase);

    private static string? SearchPath() =>
        (Environment.GetEnvironmentVariable("PATH") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(directory => Path.Combine(directory, Executable))
            .FirstOrDefault(File.Exists);

    private static IEnumerable<string> KnownLocations()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

        yield return Path.Combine(localAppData, "Programs", "mpv", Executable);
        yield return Path.Combine(programFiles, "mpv", Executable);
        yield return Path.Combine(programFilesX86, "mpv", Executable);
        yield return Path.Combine(userProfile, "scoop", "apps", "mpv", "current", Executable);
        yield return Path.Combine(localAppData, "Microsoft", "WinGet", "Links", Executable);
        yield return @"C:\ProgramData\chocolatey\bin\" + Executable;

        var wingetPackages = Path.Combine(localAppData, "Microsoft", "WinGet", "Packages");
        if (!Directory.Exists(wingetPackages)) yield break;
        foreach (var package in Directory.EnumerateDirectories(wingetPackages, "*mpv*"))
        {
            yield return Path.Combine(package, Executable);
        }
    }
}
