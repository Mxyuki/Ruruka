namespace Ruruka.Desktop.Player;

/// <summary>Which player opens episodes: Ruruka's bundled one, or the user's own mpv with their config.</summary>
internal static class PlayerChoice
{
    public const string Ruruka = "ruruka";
    public const string OwnMpv = "mpv";

    public static bool IsValid(string kind) => kind is Ruruka or OwnMpv;

    /// <summary>Someone who already set up an mpv keeps it until they choose otherwise.</summary>
    public static string Resolve(string? chosenKind, string? configuredMpvPath) =>
        chosenKind ?? (string.IsNullOrEmpty(configuredMpvPath) ? Ruruka : OwnMpv);
}

/// <summary>The mpv shipped with Ruruka and its isolated config (interface script, fonts, options).</summary>
internal static class BundledPlayer
{
    private static string Root => Path.Combine(AppContext.BaseDirectory, "player");

    public static string ExecutablePath => Path.Combine(Root, "mpv.exe");

    public static string ConfigDirectory => Path.Combine(Root, "config");

    public static bool IsAvailable => File.Exists(ExecutablePath);
}
