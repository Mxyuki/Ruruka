using System.Security.Cryptography;
using System.Text;

namespace Ruruka.Desktop.Settings;

public sealed class SettingsStore
{
    private readonly string _path;
    private readonly object _gate = new();
    private AppSettings _current;

    public SettingsStore(string path)
    {
        _path = path;
        _current = JsonDefaults.ReadFile(path, new AppSettings());
    }

    public AppSettings Current
    {
        get { lock (_gate) return _current; }
    }

    public AppSettings Apply(SettingsPatch patch) => Update(settings => settings with
    {
        AniListClientId = patch.AniListClientId ?? settings.AniListClientId,
        PlayerPath = patch.PlayerPath ?? settings.PlayerPath,
        LibraryRoot = patch.LibraryRoot ?? settings.LibraryRoot,
        IsSetupComplete = patch.IsSetupComplete ?? settings.IsSetupComplete,
        HasSkipWarning = patch.HasSkipWarning ?? settings.HasSkipWarning,
        InterfaceScale = patch.InterfaceScale ?? settings.InterfaceScale,
        IsCloseToTray = patch.IsCloseToTray ?? settings.IsCloseToTray,
        IsLaunchedAtStartup = patch.IsLaunchedAtStartup ?? settings.IsLaunchedAtStartup,
        IsPlayerKeptOpen = patch.IsPlayerKeptOpen ?? settings.IsPlayerKeptOpen,
        EpisodeCompletionPercent = patch.EpisodeCompletionPercent ?? settings.EpisodeCompletionPercent,
        MinimumWatchedPercent = patch.MinimumWatchedPercent ?? settings.MinimumWatchedPercent,
        AboutTemplate = patch.AboutTemplate ?? settings.AboutTemplate,
        MediaSectionOrder = patch.MediaSectionOrder ?? settings.MediaSectionOrder,
        MangaLanguage = patch.MangaLanguage ?? settings.MangaLanguage,
        Theme = patch.Theme ?? settings.Theme,
        ThemeLightFromMinute = patch.ThemeLightFromMinute ?? settings.ThemeLightFromMinute,
        ThemeDarkFromMinute = patch.ThemeDarkFromMinute ?? settings.ThemeDarkFromMinute,
        SearchSiteUrl = patch.SearchSiteUrl ?? settings.SearchSiteUrl,
        MangaSiteUrl = patch.MangaSiteUrl ?? settings.MangaSiteUrl,
        SongFileHostUrl = patch.SongFileHostUrl ?? settings.SongFileHostUrl,
    });

    public string? ReadToken()
    {
        var protectedToken = Current.ProtectedToken;
        if (protectedToken is null) return null;
        try
        {
            var bytes = ProtectedData.Unprotect(Convert.FromBase64String(protectedToken), null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes);
        }
        catch (CryptographicException)
        {
            // Settings copied from another Windows account can't be decrypted; treat as logged out.
            return null;
        }
    }

    public void SaveToken(string? token)
    {
        var protectedToken = token is null
            ? null
            : Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(token), null, DataProtectionScope.CurrentUser));
        Update(settings => settings with { ProtectedToken = protectedToken });
    }

    private AppSettings Update(Func<AppSettings, AppSettings> change)
    {
        lock (_gate)
        {
            _current = change(_current);
            JsonDefaults.WriteFile(_path, _current);
            return _current;
        }
    }
}
