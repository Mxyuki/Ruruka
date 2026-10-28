using System.Text.RegularExpressions;
using Ruruka.Desktop.Settings;
using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop.Bridge.Modules;

/// <param name="onChanged">Lets the window react to settings it owns, such as the interface scale and the theme.</param>
internal sealed partial class SettingsModule(SettingsStore settings, Action onChanged) : IBridgeModule
{
    private const int MaxSectionCount = 20;
    private const int MaxSiteLength = 200;

    // mpv rarely reports the very last frame, so 100 % would never be reached.
    private const int MaxWatchPercent = 95;

    public void Register(BridgeRouter router)
    {
        router.Register("settings.get", () => Task.FromResult(settings.Current.ToPublic()));
        router.Register<SettingsPatch, PublicSettings>("settings.update", patch =>
        {
            Validate(patch);
            var current = settings.Current;
            if ((patch.ThemeLightFromMinute ?? current.ThemeLightFromMinute) == (patch.ThemeDarkFromMinute ?? current.ThemeDarkFromMinute))
            {
                throw new BridgeException("Le carnet de jour et celui de nuit doivent commencer à des heures différentes.");
            }
            if (patch.IsLaunchedAtStartup is { } isLaunchedAtStartup) ApplyStartup(isLaunchedAtStartup);
            var updated = settings.Apply(patch).ToPublic();
            onChanged();
            return Task.FromResult(updated);
        });
    }

    // <-- La clé Run est écrite avant le réglage, pour ne jamais enregistrer un choix que Windows a refusé -->
    private static void ApplyStartup(bool isLaunchedAtStartup)
    {
        try
        {
            StartupRegistration.Apply(isLaunchedAtStartup);
        }
        catch (Exception error) when (error is UnauthorizedAccessException or System.Security.SecurityException or IOException)
        {
            throw new BridgeException("Windows refuse de modifier les programmes au démarrage.");
        }
    }

    private static void Validate(SettingsPatch patch)
    {
        if (patch.EpisodeCompletionPercent is < 50 or > MaxWatchPercent)
        {
            throw new BridgeException($"Un épisode compte comme vu entre 50 % et {MaxWatchPercent} %.");
        }
        if (patch.MinimumWatchedPercent is < 10 or > MaxWatchPercent)
        {
            throw new BridgeException($"Le temps vu minimum doit être entre 10 % et {MaxWatchPercent} %.");
        }
        if (patch.MediaSectionOrder is { } order && (order.Count > MaxSectionCount || order.Any(id => !SectionId().IsMatch(id))))
        {
            throw new BridgeException("Ordre des sections invalide.");
        }
        if (patch.MangaLanguage is { } language && !LanguageCode().IsMatch(language))
        {
            throw new BridgeException("Langue de lecture invalide.");
        }
        if (patch.Theme is { } theme && !AppTheme.IsKnown(theme))
        {
            throw new BridgeException("Thème inconnu.");
        }
        if (patch.ThemeLightFromMinute is < 0 or >= AppTheme.MinutesPerDay || patch.ThemeDarkFromMinute is < 0 or >= AppTheme.MinutesPerDay)
        {
            throw new BridgeException("Heure du thème invalide.");
        }
        if (!IsSiteText(patch.SearchSiteUrl) || !IsSiteText(patch.MangaSiteUrl) || !IsSiteText(patch.SongFileHostUrl))
        {
            throw new BridgeException("Adresse de site invalide.");
        }
    }

    // A wrong but well-formed address is accepted: the features behind it simply won't find anything.
    private static bool IsSiteText(string? site) => site is null || (site.Length <= MaxSiteLength && !site.Any(char.IsWhiteSpace));

    [GeneratedRegex("^[a-z]{1,24}$")]
    private static partial Regex SectionId();

    [GeneratedRegex("^[a-z]{2,3}(-[a-z]{2,4})?$")]
    private static partial Regex LanguageCode();
}
