using System.Runtime.InteropServices;

namespace Ruruka.Desktop.Windowing;

/// <summary>
/// Hides the native caption while keeping the resizable frame, so the UI draws its own title bar
/// but Windows still provides resize borders, snapping, rounded corners and the shadow.
/// </summary>
internal static partial class WindowChrome
{
    private const int WmNcCalcSize = 0x0083;
    private const int WmNcLButtonDown = 0x00A1;
    private const int HitCaption = 2;
    private const int HitTop = 12;
    private const int SmCySizeFrame = 33;
    private const int SmCxPaddedBorder = 92;
    private const uint SwpFrameChanged = 0x0020;
    private const uint SwpNoMoveSizeZOrder = 0x0001 | 0x0002 | 0x0004 | 0x0010;

    /// <summary>Asks Windows to recompute the frame once the window exists, so the caption disappears right away.</summary>
    public static void RefreshFrame(IntPtr handle) =>
        SetWindowPos(handle, IntPtr.Zero, 0, 0, 0, 0, SwpFrameChanged | SwpNoMoveSizeZOrder);

    /// <summary>
    /// Handles WM_NCCALCSIZE: lets Windows size the side and bottom borders, then moves the client
    /// area back up to the top edge. Returns false for any other message.
    /// </summary>
    public static bool TryHandleCalcSize(ref Message message, Action<Message> defaultProcedure, bool isMaximized, int dpi)
    {
        if (message.Msg != WmNcCalcSize || message.WParam == IntPtr.Zero) return false;

        var top = Marshal.PtrToStructure<NativeRect>(message.LParam).Top;
        defaultProcedure(message);
        var client = Marshal.PtrToStructure<NativeRect>(message.LParam);

        // <-- Fenêtre agrandie : Windows la fait déborder de l'écran, on retire ce débordement en haut -->
        client.Top = isMaximized ? top + FrameThickness(dpi) : top;
        Marshal.StructureToPtr(client, message.LParam, false);
        message.Result = IntPtr.Zero;
        return true;
    }

    /// <summary>Starts a native window move, as if the user had grabbed a real title bar.</summary>
    public static void StartDrag(IntPtr handle) => SendNonClientClick(handle, HitCaption);

    /// <summary>Starts a native resize from the top edge, which the hidden caption no longer provides.</summary>
    public static void StartResizeTop(IntPtr handle) => SendNonClientClick(handle, HitTop);

    // WebView2 holds the mouse capture during the click; releasing it hands the gesture to Windows.
    private static void SendNonClientClick(IntPtr handle, int hitTest)
    {
        ReleaseCapture();
        SendMessage(handle, WmNcLButtonDown, hitTest, IntPtr.Zero);
    }

    private static int FrameThickness(int dpi) =>
        GetSystemMetricsForDpi(SmCySizeFrame, (uint)dpi) + GetSystemMetricsForDpi(SmCxPaddedBorder, (uint)dpi);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool ReleaseCapture();

    [LibraryImport("user32.dll", EntryPoint = "SendMessageW")]
    private static partial IntPtr SendMessage(IntPtr hwnd, int message, nint wParam, IntPtr lParam);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [LibraryImport("user32.dll")]
    private static partial int GetSystemMetricsForDpi(int index, uint dpi);
}
