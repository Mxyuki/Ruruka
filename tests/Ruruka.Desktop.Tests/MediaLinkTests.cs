using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop.Tests;

public class MediaLinkTests
{
    [Theory]
    [InlineData("ruruka://media/123", 123)]
    [InlineData("ruruka://media/123/", 123)]
    [InlineData("RURUKA://MEDIA/123", 123)]
    public void LinkGivesTheMediaId(string link, int expected)
    {
        Assert.Equal(expected, MediaLink.Find(["--startup", link]));
    }

    [Theory]
    [InlineData("ruruka://media/abc")]
    [InlineData("ruruka://media/123/extra")]
    [InlineData("ruruka://media/123?x=1")]
    [InlineData("ruruka://media/1234567890")]
    [InlineData("ruruka://settings")]
    [InlineData("https://anilist.co/anime/123")]
    [InlineData("--startup")]
    public void AnythingElseIsIgnored(string argument)
    {
        Assert.Null(MediaLink.Find([argument]));
    }

    [Fact]
    public void CommandQuotesThePathAndTheLink()
    {
        Assert.Equal("\"C:\\Program Files\\Ruruka\\Ruruka.exe\" \"%1\"", MediaLink.CommandFor(@"C:\Program Files\Ruruka\Ruruka.exe"));
    }
}
