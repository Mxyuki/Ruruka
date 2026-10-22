using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop.Tests;

public sealed class InterfaceScaleTests
{
    [Theory]
    [InlineData(1366, 0.9)]
    [InlineData(1904, 1.0)]
    [InlineData(2048, 1.0)]
    [InlineData(2544, 1.25)]
    [InlineData(3824, 1.6)]
    public void Automatic_FollowsWindowWidth(double widthDip, double expected)
    {
        Assert.Equal(expected, InterfaceScale.For(widthDip, userScale: 0));
    }

    [Fact]
    public void UserChoice_WinsOverWindowWidth()
    {
        Assert.Equal(1.4, InterfaceScale.For(1366, userScale: 1.4));
    }
}
