using System.Runtime.InteropServices;
using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Windowing;

/// <summary>Reads where a window of another process (the bundled mpv) sits, so it can reopen there next time.</summary>
internal static partial class WindowGeometry
{
    private const uint ShowMaximized = 3;

    [StructLayout(LayoutKind.Sequential)]
    private struct Point
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Placement
    {
        public uint Length;
        public uint Flags;
        public uint ShowCommand;
        public Point MinPosition;
        public Point MaxPosition;
        public Rect NormalPosition;
    }

    /// <summary>
    /// The window's video area and whether it is maximized; null when it can't be read or it is minimized or full screen,
    /// since none of those is a place worth coming back to.
    /// </summary>
    public static PlayerWindowPlacement? Read(nint windowHandle, IReadOnlyList<Rectangle> monitors)
    {
        var placement = new Placement { Length = (uint)Marshal.SizeOf<Placement>() };
        if (!GetWindowPlacement(windowHandle, ref placement) || IsIconic(windowHandle)) return null;
        if (!GetClientRect(windowHandle, out var client)) return null;
        var origin = new Point();
        if (!ClientToScreen(windowHandle, ref origin)) return null;

        var area = new Rectangle(origin.X, origin.Y, client.Right - client.Left, client.Bottom - client.Top);
        if (area.Width <= 0 || area.Height <= 0 || monitors.Contains(area)) return null;
        return new PlayerWindowPlacement(area.X, area.Y, area.Width, area.Height, placement.ShowCommand == ShowMaximized);
    }

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool GetWindowPlacement(nint windowHandle, ref Placement placement);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool GetClientRect(nint windowHandle, out Rect rect);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool ClientToScreen(nint windowHandle, ref Point point);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool IsIconic(nint windowHandle);
}
