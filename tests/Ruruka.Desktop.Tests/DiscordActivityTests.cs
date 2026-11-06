using System.Text.Json;
using Ruruka.Desktop.Discord;

namespace Ruruka.Desktop.Tests;

public class DiscordActivityTests
{
    private const string Cover = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg";
    private static readonly DateTimeOffset Now = DateTimeOffset.FromUnixTimeSeconds(1_800_000_000);

    private static NowWatching Watching(double position = 60, double duration = 1440, bool isPaused = false, string title = "Precure", string? cover = Cover) =>
        new(123, 5, title, cover, position, duration, isPaused);

    private static JsonElement Payload(DiscordActivity activity) =>
        JsonSerializer.SerializeToElement(activity.ToPayload());

    [Fact]
    public void PlayingEpisodeGetsTheTimesOfDiscordsBar()
    {
        var activity = DiscordActivity.From(Watching(), Now);

        Assert.Equal("Precure", activity.Details);
        Assert.Equal("Épisode 5", activity.State);
        Assert.Equal(Now.AddSeconds(-60).ToUnixTimeMilliseconds(), activity.StartsAtMs);
        Assert.Equal(Now.AddSeconds(1380).ToUnixTimeMilliseconds(), activity.EndsAtMs);
    }

    [Theory]
    [InlineData(754, 1440, "Épisode 5 · En pause à 12:34 / 24:00")]
    [InlineData(3725, 7200, "Épisode 5 · En pause à 1:02:05 / 2:00:00")]
    [InlineData(0, 0, "Épisode 5 · En pause")]
    public void PausedEpisodeWritesItsTimeInsteadOfTheBar(double position, double duration, string expected)
    {
        var activity = DiscordActivity.From(Watching(position, duration, isPaused: true), Now);

        Assert.Equal(expected, activity.State);
        Assert.Null(activity.EndsAtMs);
    }

    [Fact]
    public void UnknownDurationShowsNoBar()
    {
        Assert.Null(DiscordActivity.From(Watching(duration: 0), Now).EndsAtMs);
    }

    [Fact]
    public void CoverIsTheLargeImageWithTheIconAsBadge()
    {
        var assets = Payload(DiscordActivity.From(Watching(), Now)).GetProperty("assets");

        Assert.Equal(Cover, assets.GetProperty("large_image").GetString());
        Assert.Equal(DiscordActivity.IconUrl, assets.GetProperty("small_image").GetString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("http://s4.anilist.co/cover.jpg")]
    [InlineData("https://example.com/cover.jpg")]
    [InlineData("https://anilist.co.example.com/cover.jpg")]
    public void WithoutAnAniListCoverTheIconIsTheLargeImage(string? cover)
    {
        var activity = DiscordActivity.From(Watching(cover: cover), Now);

        Assert.Null(activity.CoverUrl);
        Assert.Equal(DiscordActivity.IconUrl, Payload(activity).GetProperty("assets").GetProperty("large_image").GetString());
    }

    [Fact]
    public void ButtonOpensThePageOfThisAnime()
    {
        var button = Payload(DiscordActivity.From(Watching(), Now)).GetProperty("buttons")[0];

        Assert.Equal("https://mxyuki.github.io/Ruruka/open/?media=123", button.GetProperty("url").GetString());
        Assert.InRange(button.GetProperty("label").GetString()!.Length, 1, 32);
    }

    [Theory]
    [InlineData("K", 2)]
    [InlineData("Precure", 7)]
    public void TitleKeepsDiscordsMinimumLength(string title, int expectedLength)
    {
        Assert.Equal(expectedLength, DiscordActivity.From(Watching(title: title), Now).Details.Length);
    }

    [Fact]
    public void LongTitleIsCutToDiscordsLimit()
    {
        var activity = DiscordActivity.From(Watching(title: new string('a', 300)), Now);

        Assert.Equal(128, activity.Details.Length);
        Assert.EndsWith("…", activity.Details);
    }

    [Fact]
    public void SteadyPlaybackNeedsNoUpdate()
    {
        var shown = DiscordActivity.From(Watching(position: 60), Now);
        var later = DiscordActivity.From(Watching(position: 65), Now.AddSeconds(5.2));

        Assert.True(later.LooksLike(shown));
    }

    [Fact]
    public void SeekNeedsAnUpdate()
    {
        var shown = DiscordActivity.From(Watching(position: 60), Now);
        var later = DiscordActivity.From(Watching(position: 300), Now.AddSeconds(5));

        Assert.False(later.LooksLike(shown));
    }

    [Fact]
    public void PauseNeedsAnUpdate()
    {
        var shown = DiscordActivity.From(Watching(), Now);

        Assert.False(DiscordActivity.From(Watching(isPaused: true), Now).LooksLike(shown));
        Assert.False(shown.LooksLike(DiscordActivity.From(Watching(isPaused: true), Now)));
    }

    [Fact]
    public void FrameHoldsLittleEndianOpcodeAndByteLength()
    {
        var frame = DiscordIpcClient.EncodeFrame(1, "{\"é\":1}");

        Assert.Equal(new byte[] { 1, 0, 0, 0, 8, 0, 0, 0 }, frame[..8]);
        Assert.Equal(16, frame.Length);
    }
}
