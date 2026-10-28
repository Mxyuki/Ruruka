using Ruruka.Desktop.Manga;

namespace Ruruka.Desktop.Tests;

public sealed class MangaSiteClientTests
{
    [Theory]
    [InlineData("/manga?title=Frieren&limit=10", true)]
    [InlineData("/manga/b0b721ff-c388-4486-aa0f-c2b0bb321512", true)]
    [InlineData("/manga/b0b721ff-c388-4486-aa0f-c2b0bb321512/feed?translatedLanguage[]=fr&limit=500", true)]
    [InlineData("/at-home/server/6e04e431-fc6b-4e38-b952-6232c72df112", true)]
    [InlineData("/auth/login", false)]
    [InlineData("/user/me", false)]
    [InlineData("/manga/../user/me", false)]
    [InlineData("https://evil.example/manga", false)]
    [InlineData("/manga/b0b721ff-c388-4486-aa0f-c2b0bb321512/relation", false)]
    public void IsAllowedPath_OnlyAllowsReaderLookups(string path, bool expected)
    {
        Assert.Equal(expected, MangaSiteClient.IsAllowedPath(path));
    }

    [Theory]
    [InlineData("monsite.org", "https://api.monsite.org")]
    [InlineData("https://monsite.org/", "https://api.monsite.org")]
    [InlineData("http://api.monsite.org", "http://api.monsite.org")]
    [InlineData("", null)]
    [InlineData("ftp://monsite.org", null)]
    public void ApiBaseFor_UsesTheApiSubdomainOfTheChosenSite(string site, string? expected)
    {
        Assert.Equal(expected, MangaSiteClient.ApiBaseFor(site));
    }
}
