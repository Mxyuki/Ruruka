using Ruruka.Desktop.Updates;

namespace Ruruka.Desktop.Tests;

public sealed class UpdateServiceTests
{
    [Theory]
    [InlineData("v0.2.0", "0.1.0.0", true)]
    [InlineData("v0.1.1", "0.1.0.0", true)]
    [InlineData("1.0.0", "0.9.9.0", true)]
    [InlineData("v0.1.0", "0.1.0.0", false)]
    [InlineData("v0.1.0", "0.2.0.0", false)]
    public void IsNewer_ComparesTagWithAssemblyVersion(string tag, string current, bool expected)
    {
        Assert.True(UpdateService.TryParseTag(tag, out var latest));
        Assert.Equal(expected, UpdateService.IsNewer(latest, Version.Parse(current)));
    }

    [Fact]
    public void CurrentVersion_IsReadableOnStartup()
    {
        Assert.NotNull(new UpdateService());
        Assert.True(UpdateService.CurrentVersion > new Version(0, 0));
    }

    [Theory]
    [InlineData("nightly")]
    [InlineData("")]
    public void TryParseTag_RejectsNonVersionTags(string tag)
    {
        Assert.False(UpdateService.TryParseTag(tag, out _));
    }
}
