using System.Runtime.InteropServices;

namespace Ruruka.Desktop.Windowing;

/// <summary>Colors the native Windows 11 title bar like the notebook: milk background, plum ink text.</summary>
internal static partial class TitleBarTheme
{
    private const int UseImmersiveDarkMode = 20;
    private const int BorderColor = 34;
    private const int CaptionColor = 35;
    private const int TextColor = 36;

    public static readonly Color Background = Color.FromArgb(0xfb, 0xf7, 0xef);
    private static readonly Color Ink = Color.FromArgb(0x2b, 0x1e, 0x30);

    public static void Apply(IntPtr windowHandle)
    {
        SetAttribute(windowHandle, UseImmersiveDarkMode, 0);
        SetAttribute(windowHandle, CaptionColor, ToColorRef(Background));
        SetAttribute(windowHandle, BorderColor, ToColorRef(Ink));
        SetAttribute(windowHandle, TextColor, ToColorRef(Ink));
    }

    // DWM expects COLORREF, which is 0x00BBGGRR.
    private static int ToColorRef(Color color) => color.R | (color.G << 8) | (color.B << 16);

    // Older Windows builds reject the color attributes; the default title bar is an acceptable fallback.
    private static void SetAttribute(IntPtr handle, int attribute, int value) =>
        _ = DwmSetWindowAttribute(handle, attribute, ref value, sizeof(int));

    [LibraryImport("dwmapi.dll")]
    private static partial int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
}
