namespace Ruruka.Desktop.Windowing;

/// <summary>
/// Picks the WebView2 zoom so the UI fills the window at a comfortable size. Widths are in
/// device-independent pixels, so Windows display scaling is already accounted for.
/// </summary>
internal static class InterfaceScale
{
    // (minimum window width, zoom): a maximized 1080p window at 100% scaling is ~1920 wide,
    // 1440p is ~2560, 4K is ~3840.
    private static readonly (double MinWidth, double Zoom)[] Breakpoints =
    [
        (3200, 1.6),
        (2400, 1.25),
        (2100, 1.12),
        (1600, 1.0),
        (0, 0.9),
    ];

    /// <param name="userScale">The user's chosen zoom, or 0 for automatic.</param>
    public static double For(double windowWidthDip, double userScale) =>
        userScale > 0 ? userScale : Breakpoints.First(breakpoint => windowWidthDip >= breakpoint.MinWidth).Zoom;
}
