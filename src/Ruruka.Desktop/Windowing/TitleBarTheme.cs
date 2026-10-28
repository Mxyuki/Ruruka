using System.Runtime.InteropServices;

namespace Ruruka.Desktop.Windowing;

/// <summary>Colors the native Windows 11 frame like the notebook: milk by day, night plum in the dark theme.</summary>
internal static partial class TitleBarTheme
{
    private const int UseImmersiveDarkMode = 20;
    private const int BorderColor = 34;
    private const int CaptionColor = 35;
    private const int TextColor = 36;

    // Same values as --colorMilk, --colorInk, --colorMauve and --textMain in web/src/styles/tokens.css.
    private static readonly Color LightBackground = Color.FromArgb(0xfb, 0xf7, 0xef);
    private static readonly Color LightInk = Color.FromArgb(0x2b, 0x1e, 0x30);
    private static readonly Color DarkBackground = Color.FromArgb(0x1b, 0x15, 0x20);
    private static readonly Color DarkBorder = Color.FromArgb(0x45, 0x32, 0x4f);
    private static readonly Color DarkInk = Color.FromArgb(0xf2, 0xe9, 0xf5);

    public static Color BackgroundFor(bool isDark) => isDark ? DarkBackground : LightBackground;

    public static void Apply(IntPtr windowHandle, bool isDark)
    {
        SetAttribute(windowHandle, UseImmersiveDarkMode, isDark ? 1 : 0);
        SetAttribute(windowHandle, CaptionColor, ToColorRef(BackgroundFor(isDark)));
        SetAttribute(windowHandle, BorderColor, ToColorRef(isDark ? DarkBorder : LightInk));
        SetAttribute(windowHandle, TextColor, ToColorRef(isDark ? DarkInk : LightInk));
    }

    // DWM expects COLORREF, which is 0x00BBGGRR.
    private static int ToColorRef(Color color) => color.R | (color.G << 8) | (color.B << 16);

    // Older Windows builds reject the color attributes; the default title bar is an acceptable fallback.
    private static void SetAttribute(IntPtr handle, int attribute, int value) =>
        _ = DwmSetWindowAttribute(handle, attribute, ref value, sizeof(int));

    [LibraryImport("dwmapi.dll")]
    private static partial int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
}
