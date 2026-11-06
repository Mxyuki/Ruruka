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
    public void AppNameStaysAndTheStatusShowsTheAnime()
    {
        var payload = Payload(DiscordActivity.From(Watching(), Now));

        Assert.False(payload.TryGetProperty("name", out _));
        Assert.Equal(2, payload.GetProperty("status_display_type").GetInt32());
        Assert.Equal("Precure", payload.GetProperty("details").GetString());
        Assert.Equal("Épisode 5", payload.GetProperty("state").GetString());
    }

    [Fact]
    public void EpisodeInASessionIsAPlainWatchingActivity()
    {
        var activity = DiscordActivity.ForNow(Watching(), new SessionInvite("7KX3P-QM9TZ", 2), null, Now);
        var payload = Payload(activity!);

        Assert.Equal(3, payload.GetProperty("type").GetInt32());
        Assert.Equal(JsonValueKind.Null, payload.GetProperty("secrets").ValueKind);
        Assert.Equal(JsonValueKind.Array, payload.GetProperty("buttons").ValueKind);
        Assert.NotNull(activity!.EndsAtMs);
    }

    [Fact]
    public void WaitingSessionIsPlayingSoDiscordOffersInvitations()
    {
        var activity = DiscordActivity.ForNow(null, new SessionInvite("7KX3P-QM9TZ", 1), null, Now);

        Assert.Equal(0, Payload(activity!).GetProperty("type").GetInt32());
    }

    [Fact]
    public void FollowedEpisodeIsWatchedWithItsTimeBar()
    {
        var followed = new SessionEpisode(123, 5, "Precure", Cover, 60, 1440).ToNowWatching();

        var activity = DiscordActivity.ForNow(followed, null, "Avec Alice", Now)!;

        Assert.Equal("Épisode 5", activity.State);
        Assert.Equal(Now.AddSeconds(1380).ToUnixTimeMilliseconds(), activity.EndsAtMs);
        Assert.Equal(3, Payload(activity).GetProperty("type").GetInt32());
    }

    [Fact]
    public void NothingToShowClearsTheActivity()
    {
        Assert.Null(DiscordActivity.ForNow(null, null, null, Now));
    }

    [Fact]
    public void HostedSessionTradesTheButtonForAnInvitation()
    {
        var payload = Payload(DiscordActivity.ForOpenSession(new SessionInvite("7KX3P-QM9TZ", 3)));

        Assert.Equal(JsonValueKind.Null, payload.GetProperty("buttons").ValueKind);
        Assert.Equal("7KX3P-QM9TZ", payload.GetProperty("secrets").GetProperty("join").GetString());
        Assert.True(payload.GetProperty("instance").GetBoolean());
        Assert.Equal(3, payload.GetProperty("party").GetProperty("size")[0].GetInt32());
        Assert.Equal(10, payload.GetProperty("party").GetProperty("size")[1].GetInt32());
    }

    [Fact]
    public void PublicPartyIdDoesNotHoldTheCode()
    {
        var party = Payload(DiscordActivity.ForOpenSession(new SessionInvite("7KX3P-QM9TZ", 1))).GetProperty("party");

        Assert.DoesNotContain("7KX3P", party.GetProperty("id").GetString());
    }

    [Fact]
    public void LargerSessionRaisesThePartySize()
    {
        var size = Payload(DiscordActivity.ForOpenSession(new SessionInvite("7KX3P-QM9TZ", 14))).GetProperty("party").GetProperty("size");

        Assert.Equal(14, size[1].GetInt32());
    }

    [Fact]
    public void NewFriendInTheSessionNeedsAnUpdate()
    {
        var shown = DiscordActivity.ForOpenSession(new SessionInvite("7KX3P-QM9TZ", 1));

        Assert.False(DiscordActivity.ForOpenSession(new SessionInvite("7KX3P-QM9TZ", 2)).LooksLike(shown));
    }

    [Fact]
    public void OpenSessionWithoutEpisodeStaysInvitable()
    {
        var payload = Payload(DiscordActivity.ForOpenSession(new SessionInvite("7KX3P-QM9TZ", 1)));

        Assert.Equal("7KX3P-QM9TZ", payload.GetProperty("secrets").GetProperty("join").GetString());
        Assert.Equal(DiscordActivity.IconUrl, payload.GetProperty("assets").GetProperty("large_image").GetString());
    }

    [Theory]
    [InlineData(new string[0], null)]
    [InlineData(new[] { "Alice" }, "Avec Alice")]
    [InlineData(new[] { "Alice", "Bob" }, "Avec Alice et Bob")]
    [InlineData(new[] { "Alice", "Bob", "Charlie" }, "Avec Alice, Bob et Charlie")]
    public void CompanionsAreNamed(string[] names, string? expected)
    {
        Assert.Equal(expected, DiscordActivity.DescribeCompanions(names));
    }

    [Fact]
    public void TooManyCompanionsAreCounted()
    {
        var names = Enumerable.Range(1, 30).Select(number => $"Detective{number:00}").ToList();

        var text = DiscordActivity.DescribeCompanions(names)!;

        Assert.InRange(text.Length, 1, 128);
        Assert.Matches(@"^Avec Detective01, .* et \d+ autres$", text);
    }

    [Fact]
    public void NameTooLongForDiscordIsNotShown()
    {
        Assert.Equal("Avec d'autres détectives", DiscordActivity.DescribeCompanions([new string('a', 200)]));
    }

    [Fact]
    public void CompanionsAppearOnTheRurukaBadge()
    {
        var assets = Payload(DiscordActivity.ForNow(Watching(), null, "Avec Alice", Now)!).GetProperty("assets");

        Assert.Equal("Avec Alice", assets.GetProperty("small_text").GetString());
        Assert.Equal("Precure", assets.GetProperty("large_text").GetString());
    }

    [Fact]
    public void WithoutCoverCompanionsAppearOnTheLargeImage()
    {
        var assets = Payload(DiscordActivity.ForNow(Watching(cover: null), null, "Avec Alice", Now)!).GetProperty("assets");

        Assert.Equal("Avec Alice", assets.GetProperty("large_text").GetString());
    }

    [Fact]
    public void FriendLeavingNeedsAnUpdate()
    {
        var shown = DiscordActivity.ForNow(Watching(), null, "Avec Alice et Bob", Now);

        Assert.False(DiscordActivity.ForNow(Watching(), null, "Avec Alice", Now)!.LooksLike(shown));
    }

    [Fact]
    public void FrameHoldsLittleEndianOpcodeAndByteLength()
    {
        var frame = DiscordIpcClient.EncodeFrame(1, "{\"é\":1}");

        Assert.Equal(new byte[] { 1, 0, 0, 0, 8, 0, 0, 0 }, frame[..8]);
        Assert.Equal(16, frame.Length);
    }
}
