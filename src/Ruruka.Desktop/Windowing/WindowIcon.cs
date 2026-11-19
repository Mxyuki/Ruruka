using System.Runtime.InteropServices;

namespace Ruruka.Desktop.Windowing;

/// <summary>Gives a window of another process (the bundled mpv) the Ruruka icon, which is what the taskbar and Alt+Tab show.</summary>
internal static partial class WindowIcon
{
    private const uint SetIconMessage = 0x0080;
    private const int SmallIcon = 0;
    private const int BigIcon = 1;
    private const int BigIconMetric = 11;
    private const int SmallIconMetric = 49;
    private const uint AbortIfHung = 0x0002;
    private const uint SendTimeoutMilliseconds = 1000;

    // The window keeps pointing at these handles, so the icons live as long as the app.
    private static readonly Lazy<(Icon Small, Icon Big)?> Icons = new(Load);

    public static void Apply(nint windowHandle)
    {
        if (Icons.Value is not { } icons) return;
        SendMessageTimeout(windowHandle, SetIconMessage, SmallIcon, icons.Small.Handle, AbortIfHung, SendTimeoutMilliseconds, out _);
        SendMessageTimeout(windowHandle, SetIconMessage, BigIcon, icons.Big.Handle, AbortIfHung, SendTimeoutMilliseconds, out _);
    }

    private static (Icon Small, Icon Big)? Load()
    {
        var small = Read(GetSystemMetrics(SmallIconMetric));
        var big = Read(GetSystemMetrics(BigIconMetric));
        return small is null || big is null ? null : (small, big);
    }

    private static Icon? Read(int size)
    {
        using var stream = typeof(WindowIcon).Assembly.GetManifestResourceStream("Ruruka.ico");
        return stream is null ? null : new Icon(stream, new Size(size, size));
    }

    [LibraryImport("user32.dll")]
    private static partial int GetSystemMetrics(int index);

    [LibraryImport("user32.dll", EntryPoint = "SendMessageTimeoutW")]
    private static partial nint SendMessageTimeout(nint windowHandle, uint message, nint wParam, nint lParam, uint flags, uint timeoutMilliseconds, out nint result);
}
