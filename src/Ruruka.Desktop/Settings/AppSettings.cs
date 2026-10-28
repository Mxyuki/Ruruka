namespace Ruruka.Desktop.Settings;

/// <summary>Everything persisted in settings.json.</summary>
public sealed record AppSettings
{
    public string? AniListClientId { get; init; }

    /// <summary>DPAPI-encrypted, base64-encoded AniList access token.</summary>
    public string? ProtectedToken { get; init; }

    public string? PlayerPath { get; init; }

    public string? LibraryRoot { get; init; }

    public bool IsSetupComplete { get; init; }

    public bool HasSkipWarning { get; init; } = true;

    /// <summary>UI zoom chosen by the user; 0 picks one from the window size.</summary>
    public double InterfaceScale { get; init; }

    /// <summary>The close button hides the window to the notification area so playback tracking keeps running.</summary>
    public bool IsCloseToTray { get; init; } = true;

    /// <summary>Windows starts Ruruka at sign-in, hidden in the notification area.</summary>
    public bool IsLaunchedAtStartup { get; init; }

    /// <summary>mpv stays open on the last frame of an episode, so the next one plays in the same window.</summary>
    public bool IsPlayerKeptOpen { get; init; } = true;

    /// <summary>How far into an episode (in %) playback must reach before it counts as watched.</summary>
    public int EpisodeCompletionPercent { get; init; } = 85;

    /// <summary>The share of an episode (in %) that must really be played, so skipped parts stay allowed up to the rest.</summary>
    public int MinimumWatchedPercent { get; init; } = 50;

    /// <summary>The profile "about" with live tags, kept on this PC only; empty when the about is plain text.</summary>
    public string AboutTemplate { get; init; } = "";

    /// <summary>Media page sections in the user's order; empty keeps the default order.</summary>
    public IReadOnlyList<string> MediaSectionOrder { get; init; } = [];

    /// <summary>Translation language for chapter lists (ISO code such as "fr" or "pt-br").</summary>
    public string MangaLanguage { get; init; } = "fr";

    /// <summary>"light", "dark" or "system" (follows the Windows app mode); see <c>AppTheme</c>.</summary>
    public string Theme { get; init; } = "light";

    /// <summary>With the "schedule" theme, the light notebook starts at this minute of the day (9:00).</summary>
    public int ThemeLightFromMinute { get; init; } = 9 * 60;

    /// <summary>With the "schedule" theme, the night notebook starts at this minute of the day (18:00).</summary>
    public int ThemeDarkFromMinute { get; init; } = 18 * 60;

    /// <summary>Base URL of the torrent search site behind the search buttons ("monsite.org"); empty hides them.</summary>
    public string SearchSiteUrl { get; init; } = "";

    /// <summary>Manga site whose API lists and serves chapters; empty hides chapter reading.</summary>
    public string MangaSiteUrl { get; init; } = "";

    /// <summary>Server that hosts the anime song files listed by AnisongDB; empty hides the players.</summary>
    public string SongFileHostUrl { get; init; } = "";

    public PublicSettings ToPublic() => new(
        AniListClientId,
        ProtectedToken is not null,
        PlayerPath,
        LibraryRoot,
        IsSetupComplete,
        HasSkipWarning,
        InterfaceScale,
        IsCloseToTray,
        IsLaunchedAtStartup,
        IsPlayerKeptOpen,
        EpisodeCompletionPercent,
        MinimumWatchedPercent,
        AboutTemplate,
        MediaSectionOrder,
        MangaLanguage,
        Theme,
        ThemeLightFromMinute,
        ThemeDarkFromMinute,
        SearchSiteUrl,
        MangaSiteUrl,
        SongFileHostUrl);
}

/// <summary>The settings the UI may see: the token is reduced to whether one exists.</summary>
public sealed record PublicSettings(
    string? AniListClientId,
    bool IsLoggedIn,
    string? PlayerPath,
    string? LibraryRoot,
    bool IsSetupComplete,
    bool HasSkipWarning,
    double InterfaceScale,
    bool IsCloseToTray,
    bool IsLaunchedAtStartup,
    bool IsPlayerKeptOpen,
    int EpisodeCompletionPercent,
    int MinimumWatchedPercent,
    string AboutTemplate,
    IReadOnlyList<string> MediaSectionOrder,
    string MangaLanguage,
    string Theme,
    int ThemeLightFromMinute,
    int ThemeDarkFromMinute,
    string SearchSiteUrl,
    string MangaSiteUrl,
    string SongFileHostUrl);

/// <summary>A partial update from the UI; null fields are left unchanged.</summary>
public sealed record SettingsPatch
{
    public string? AniListClientId { get; init; }
    public string? PlayerPath { get; init; }
    public string? LibraryRoot { get; init; }
    public bool? IsSetupComplete { get; init; }
    public bool? HasSkipWarning { get; init; }
    public double? InterfaceScale { get; init; }
    public bool? IsCloseToTray { get; init; }
    public bool? IsLaunchedAtStartup { get; init; }
    public bool? IsPlayerKeptOpen { get; init; }
    public int? EpisodeCompletionPercent { get; init; }
    public int? MinimumWatchedPercent { get; init; }

    /// <summary>An empty string clears the template.</summary>
    public string? AboutTemplate { get; init; }

    /// <summary>An empty list restores the default order.</summary>
    public IReadOnlyList<string>? MediaSectionOrder { get; init; }

    public string? MangaLanguage { get; init; }
    public string? Theme { get; init; }
    public int? ThemeLightFromMinute { get; init; }
    public int? ThemeDarkFromMinute { get; init; }

    /// <summary>An empty string hides the search buttons.</summary>
    public string? SearchSiteUrl { get; init; }

    /// <summary>An empty string hides chapter reading.</summary>
    public string? MangaSiteUrl { get; init; }

    /// <summary>An empty string hides the song players.</summary>
    public string? SongFileHostUrl { get; init; }
}
