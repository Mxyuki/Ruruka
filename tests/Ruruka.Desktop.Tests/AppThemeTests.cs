using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop.Tests;

public sealed class AppThemeTests
{
    [Theory]
    [InlineData("light", false, false)]
    [InlineData("light", true, false)]
    [InlineData("dark", false, true)]
    [InlineData("system", false, false)]
    [InlineData("system", true, true)]
    public void IsDark_FollowsChoiceThenWindows(string theme, bool isWindowsDark, bool expected)
    {
        Assert.Equal(expected, AppTheme.IsDark(theme, isWindowsDark, isNight: false));
    }

    [Theory]
    [InlineData("schedule", true, true)]
    [InlineData("schedule", false, false)]
    [InlineData("light", true, false)]
    public void IsDark_FollowsTheScheduleOnlyWhenChosen(string theme, bool isNight, bool expected)
    {
        Assert.Equal(expected, AppTheme.IsDark(theme, isWindowsDark: false, isNight));
    }

    [Theory]
    [InlineData(8 * 60 + 59, true)]
    [InlineData(9 * 60, false)]
    [InlineData(17 * 60 + 59, false)]
    [InlineData(18 * 60, true)]
    [InlineData(23 * 60, true)]
    public void IsNight_IsDarkFromEveningToMorning(int minuteOfDay, bool expected)
    {
        Assert.Equal(expected, AppTheme.IsNight(minuteOfDay, 9 * 60, 18 * 60));
    }

    [Theory]
    [InlineData(5 * 60, false)]
    [InlineData(7 * 60, true)]
    [InlineData(23 * 60, false)]
    public void IsNight_HandlesALightPeriodAcrossMidnight(int minuteOfDay, bool expected)
    {
        Assert.Equal(expected, AppTheme.IsNight(minuteOfDay, lightFromMinute: 20 * 60, darkFromMinute: 6 * 60));
    }

    [Theory]
    [InlineData(10, 0, 8 * 60)]
    [InlineData(18, 0, 15 * 60)]
    [InlineData(23, 30, 9 * 60 + 30)]
    public void UntilNextSwitch_PointsAtTheNextBoundary(int hour, int minute, int expectedMinutes)
    {
        var now = new DateTime(2026, 10, 28, hour, minute, 0);
        Assert.Equal(TimeSpan.FromMinutes(expectedMinutes), AppTheme.UntilNextSwitch(now, 9 * 60, 18 * 60));
    }

    [Theory]
    [InlineData("light", true)]
    [InlineData("dark", true)]
    [InlineData("system", true)]
    [InlineData("schedule", true)]
    [InlineData("Dark", false)]
    [InlineData("", false)]
    public void IsKnown_AcceptsOnlyTheFourChoices(string theme, bool expected)
    {
        Assert.Equal(expected, AppTheme.IsKnown(theme));
    }
}
