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

    public PublicSettings ToPublic() => new(
        AniListClientId,
        ProtectedToken is not null,
        PlayerPath,
        LibraryRoot,
        IsSetupComplete,
        HasSkipWarning,
        InterfaceScale,
        IsCloseToTray);
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
    bool IsCloseToTray);

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
}
