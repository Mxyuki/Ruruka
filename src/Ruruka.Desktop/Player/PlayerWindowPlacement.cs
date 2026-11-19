using System.Globalization;

namespace Ruruka.Desktop.Player;

/// <summary>Where the player's video area was, in screen pixels, the last time the person had it open.</summary>
public sealed record PlayerWindowPlacement(int X, int Y, int Width, int Height, bool IsMaximized);

/// <summary>A monitor as the player window placement needs it.</summary>
public sealed record ScreenArea(string Name, Rectangle Bounds, bool IsPrimary);

/// <summary>A monitor as the settings page lists it.</summary>
public sealed record ScreenChoice(string Name, int Number, int Width, int Height, bool IsPrimary, bool IsAppScreen);

/// <summary>Chooses the mpv options that put the player window on the right monitor (or back where it was).</summary>
internal static class PlayerWindowOptions
{
    internal const string ModeApp = "app";
    internal const string ModeFixed = "fixed";
    internal const string ModeLast = "last";

    internal static bool IsKnownMode(string mode) => mode is ModeApp or ModeFixed or ModeLast;

    /// <summary>
    /// The mpv options for a new player window. A single monitor needs none: mpv's own choice is the only one there is.
    /// </summary>
    internal static Dictionary<string, string> Resolve(string mode, string screenName, PlayerWindowPlacement? lastPlacement, IReadOnlyList<ScreenArea> screens, Rectangle appBounds)
    {
        var options = new Dictionary<string, string>();
        if (screens.Count < 2) return options;

        var target = TargetScreen(mode, screenName, lastPlacement, screens, appBounds);
        var index = IndexOf(target, screens).ToString(CultureInfo.InvariantCulture);
        options["screen"] = index;
        options["fs-screen"] = index;

        if (mode == ModeLast && lastPlacement is { } placement && OverlapArea(target.Bounds, PlacementBounds(placement)) > 0)
        {
            // <-- Avec --screen, mpv lit la position de --geometry depuis le coin de cet écran -->
            var x = Math.Max(0, placement.X - target.Bounds.X);
            var y = Math.Max(0, placement.Y - target.Bounds.Y);
            options["geometry"] = $"{placement.Width}x{placement.Height}+{x}+{y}";
            if (placement.IsMaximized) options["window-maximized"] = "yes";
        }
        return options;
    }

    /// <summary>The monitor sharing the most area with <paramref name="area"/>; the primary one when it touches none.</summary>
    internal static ScreenArea MostOverlapping(Rectangle area, IReadOnlyList<ScreenArea> screens)
    {
        var best = screens.MaxBy(screen => OverlapArea(screen.Bounds, area));
        return best is not null && OverlapArea(best.Bounds, area) > 0 ? best : screens.FirstOrDefault(screen => screen.IsPrimary) ?? screens[0];
    }

    private static ScreenArea TargetScreen(string mode, string screenName, PlayerWindowPlacement? lastPlacement, IReadOnlyList<ScreenArea> screens, Rectangle appBounds)
    {
        if (mode == ModeFixed && screens.FirstOrDefault(screen => screen.Name == screenName) is { } chosen) return chosen;
        // <-- Un écran débranché depuis la dernière fois : on retombe sur celui de Ruruka plutôt que de cacher la fenêtre hors de portée -->
        if (mode == ModeLast && lastPlacement is { } placement && screens.Any(screen => OverlapArea(screen.Bounds, PlacementBounds(placement)) > 0))
        {
            return MostOverlapping(PlacementBounds(placement), screens);
        }
        return MostOverlapping(appBounds, screens);
    }

    private static Rectangle PlacementBounds(PlayerWindowPlacement placement) => new(placement.X, placement.Y, placement.Width, placement.Height);

    private static int IndexOf(ScreenArea target, IReadOnlyList<ScreenArea> screens)
    {
        for (var index = 0; index < screens.Count; index++)
        {
            if (screens[index].Name == target.Name) return index;
        }
        return 0;
    }

    private static long OverlapArea(Rectangle first, Rectangle second)
    {
        var overlap = Rectangle.Intersect(first, second);
        return overlap.IsEmpty ? 0 : (long)overlap.Width * overlap.Height;
    }
}
