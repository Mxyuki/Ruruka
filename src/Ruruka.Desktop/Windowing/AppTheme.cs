using Microsoft.Win32;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Windowing;

/// <summary>
/// The Settings theme choice: the light notebook, the night one, whichever Windows uses for apps,
/// or a schedule (light from one time of day, dark from another).
/// </summary>
internal static class AppTheme
{
    public const string Light = "light";
    public const string Dark = "dark";
    public const string System = "system";
    public const string Schedule = "schedule";

    public const int MinutesPerDay = 24 * 60;

    private const string PersonalizeKey = @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";

    public static bool IsKnown(string theme) => theme is Light or Dark or System or Schedule;

    public static bool IsDark(string theme, bool isWindowsDark, bool isNight) => theme switch
    {
        Dark => true,
        System => isWindowsDark,
        Schedule => isNight,
        _ => false,
    };

    /// <summary>Resolves the theme against the current Windows app mode and time of day.</summary>
    public static bool IsDark(AppSettings settings)
    {
        var theme = settings.Theme;
        var isNight = theme == Schedule && IsNight(MinuteOfDay(DateTime.Now), settings.ThemeLightFromMinute, settings.ThemeDarkFromMinute);
        return IsDark(theme, theme == System && IsWindowsDark(), isNight);
    }

    /// <summary>True between <paramref name="darkFromMinute"/> and <paramref name="lightFromMinute"/>, across midnight if needed.</summary>
    public static bool IsNight(int minuteOfDay, int lightFromMinute, int darkFromMinute) =>
        lightFromMinute < darkFromMinute
            ? minuteOfDay < lightFromMinute || minuteOfDay >= darkFromMinute
            : minuteOfDay >= darkFromMinute && minuteOfDay < lightFromMinute;

    /// <summary>Time left until the schedule next switches between light and dark.</summary>
    public static TimeSpan UntilNextSwitch(DateTime now, int lightFromMinute, int darkFromMinute)
    {
        var minuteOfDay = now.TimeOfDay.TotalMinutes;
        return TimeSpan.FromMinutes(Math.Min(MinutesUntil(lightFromMinute, minuteOfDay), MinutesUntil(darkFromMinute, minuteOfDay)));
    }

    // A switch happening right now counts as tomorrow's, so the timer never fires twice in a row.
    private static double MinutesUntil(int switchMinute, double minuteOfDay)
    {
        var minutes = (switchMinute - minuteOfDay + MinutesPerDay) % MinutesPerDay;
        return minutes > 0 ? minutes : MinutesPerDay;
    }

    private static int MinuteOfDay(DateTime time) => time.Hour * 60 + time.Minute;

    // Windows writes AppsUseLightTheme = 0 in dark app mode; a missing value means light.
    private static bool IsWindowsDark() => Registry.GetValue(PersonalizeKey, "AppsUseLightTheme", 1) is 0;
}
