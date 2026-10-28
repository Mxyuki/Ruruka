using Microsoft.Win32;

namespace Ruruka.Desktop.Windowing;

/// <summary>Adds Ruruka to, or removes it from, the current user's Windows startup programs (the HKCU Run key).</summary>
internal static class StartupRegistration
{
    /// <summary>Passed by Windows at sign-in, so the window starts hidden in the notification area.</summary>
    public const string StartupArgument = "--startup";

    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "Ruruka";

    public static void Apply(bool isLaunchedAtStartup)
    {
        using var runKey = Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true);
        if (isLaunchedAtStartup) runKey.SetValue(ValueName, CommandFor(Environment.ProcessPath!));
        else runKey.DeleteValue(ValueName, throwOnMissingValue: false);
    }

    internal static string CommandFor(string executablePath) => $"\"{executablePath}\" {StartupArgument}";
}
