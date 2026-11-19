using System.Drawing;
using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Tests;

public sealed class PlayerWindowTests
{
    private static readonly ScreenArea Left = new(@"\\.\DISPLAY1", new Rectangle(0, 0, 1920, 1080), IsPrimary: true);
    private static readonly ScreenArea Right = new(@"\\.\DISPLAY2", new Rectangle(1920, 0, 2560, 1440), IsPrimary: false);
    private static readonly ScreenArea[] TwoScreens = [Left, Right];

    private static readonly Rectangle AppOnRight = new(2400, 200, 1200, 800);

    [Fact]
    public void OneScreen_NeedsNoOption()
    {
        var options = PlayerWindowOptions.Resolve("fixed", Left.Name, null, [Left], AppOnRight);

        Assert.Empty(options);
    }

    [Fact]
    public void AppMode_OpensOnTheMonitorOfTheAppWindow()
    {
        var options = PlayerWindowOptions.Resolve("app", "", null, TwoScreens, AppOnRight);

        Assert.Equal("1", options["screen"]);
        Assert.Equal("1", options["fs-screen"]);
        Assert.DoesNotContain("geometry", options.Keys);
    }

    [Fact]
    public void FixedMode_OpensOnTheChosenMonitor()
    {
        var options = PlayerWindowOptions.Resolve("fixed", Left.Name, null, TwoScreens, AppOnRight);

        Assert.Equal("0", options["screen"]);
    }

    [Fact]
    public void FixedMode_FallsBackToTheAppMonitorWhenTheChosenOneIsGone()
    {
        var options = PlayerWindowOptions.Resolve("fixed", @"\\.\DISPLAY9", null, TwoScreens, AppOnRight);

        Assert.Equal("1", options["screen"]);
    }

    [Fact]
    public void LastMode_ReopensAtTheSavedPlaceRelativeToItsMonitor()
    {
        var saved = new PlayerWindowPlacement(2020, 100, 1280, 720, IsMaximized: false);

        var options = PlayerWindowOptions.Resolve("last", "", saved, TwoScreens, new Rectangle(100, 100, 800, 600));

        Assert.Equal("1", options["screen"]);
        Assert.Equal("1280x720+100+100", options["geometry"]);
        Assert.DoesNotContain("window-maximized", options.Keys);
    }

    [Fact]
    public void LastMode_RestoresAMaximizedWindow()
    {
        var saved = new PlayerWindowPlacement(0, 0, 1920, 1040, IsMaximized: true);

        var options = PlayerWindowOptions.Resolve("last", "", saved, TwoScreens, AppOnRight);

        Assert.Equal("0", options["screen"]);
        Assert.Equal("yes", options["window-maximized"]);
    }

    [Fact]
    public void LastMode_IgnoresAPlaceOnAMonitorThatIsGone()
    {
        var saved = new PlayerWindowPlacement(6000, 100, 1280, 720, IsMaximized: false);

        var options = PlayerWindowOptions.Resolve("last", "", saved, TwoScreens, AppOnRight);

        Assert.Equal("1", options["screen"]);
        Assert.DoesNotContain("geometry", options.Keys);
    }

    [Fact]
    public void LastMode_WithoutAPlaceFollowsTheApp()
    {
        var options = PlayerWindowOptions.Resolve("last", "", null, TwoScreens, AppOnRight);

        Assert.Equal("1", options["screen"]);
    }

    [Fact]
    public void Navigation_BecomesScriptOptionsTheBarCanRead()
    {
        var navigation = new EpisodeNavigation(6, 8, null);

        Assert.Equal("ruruka-previous=6,ruruka-next=8,ruruka-prompt=no", navigation.ToScriptOptions());
    }
}
