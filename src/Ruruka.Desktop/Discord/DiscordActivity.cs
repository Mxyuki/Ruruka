using System.Security.Cryptography;
using System.Text;

namespace Ruruka.Desktop.Discord;

/// <summary>The session this PC hosts: friends invited from Discord receive its code.</summary>
internal sealed record SessionInvite(string Code, int MemberCount);

/// <summary>What the Ruruka player shows right now.</summary>
internal sealed record NowWatching(int MediaId, int Episode, string Title, string? CoverUrl, double PositionSeconds, double DurationSeconds, bool IsPaused);

/// <summary>A Discord "Watching" activity; start and end times make Discord draw its time bar.</summary>
internal sealed record DiscordActivity(int MediaId, string Details, string State, string? CoverUrl, long? StartsAtMs, long? EndsAtMs, SessionInvite? Invite = null)
{
    internal const string IconUrl = "https://raw.githubusercontent.com/Mxyuki/Ruruka/main/assets/icon.png";

    // Discord only accepts http(s) buttons, so a page opens ruruka:// or falls back to AniList.
    internal const string OpenPageUrl = "https://mxyuki.github.io/Ruruka/open/?media=";

    private const int WatchingType = 3;
    private const int ShowDetailsInStatus = 2;
    private const int MaxTextLength = 128;
    private const int MaxImageUrlLength = 256;
    private const string ButtonLabel = "Ouvrir dans Ruruka";

    // Discord wants a group size; sessions have no real limit, so a larger one simply raises it.
    private const int ShownPartySize = 10;
    private const int PartyIdLength = 16;

    // Two points of the same stretch land slightly apart; only a seek or another speed moves the end this far.
    private const long DriftToleranceMs = 4000;

    /// <summary>A hosted session with nothing playing, so friends can already be invited.</summary>
    public static DiscordActivity ForOpenSession(SessionInvite invite) => new(0, "Séance Ruruka", "Séance ouverte", null, null, null, invite);

    public static DiscordActivity From(NowWatching watching, DateTimeOffset now, SessionInvite? invite = null)
    {
        var episode = $"Épisode {watching.Episode}";
        var details = DiscordText(watching.Title);
        var cover = IsAniListImage(watching.CoverUrl) ? watching.CoverUrl : null;
        var hasDuration = watching.DurationSeconds > 0;
        if (watching.IsPaused)
        {
            var pausedAt = hasDuration ? $" à {Clock(watching.PositionSeconds)} / {Clock(watching.DurationSeconds)}" : "";
            return new DiscordActivity(watching.MediaId, details, $"{episode} · En pause{pausedAt}", cover, null, null, invite);
        }
        if (!hasDuration) return new DiscordActivity(watching.MediaId, details, episode, cover, null, null, invite);

        var startsAt = now.AddSeconds(-watching.PositionSeconds);
        var endsAt = startsAt.AddSeconds(watching.DurationSeconds);
        return new DiscordActivity(watching.MediaId, details, episode, cover, startsAt.ToUnixTimeMilliseconds(), endsAt.ToUnixTimeMilliseconds(), invite);
    }

    /// <summary>Whether Discord already shows this, so the update can be skipped (5 updates per 20 s at most).</summary>
    public bool LooksLike(DiscordActivity? shown)
    {
        if (shown is null) return false;
        if (this with { StartsAtMs = shown.StartsAtMs, EndsAtMs = shown.EndsAtMs } != shown) return false;
        if (EndsAtMs is not { } endsAt || shown.EndsAtMs is not { } shownEnd) return EndsAtMs == shown.EndsAtMs;
        return Math.Abs(endsAt - shownEnd) <= DriftToleranceMs;
    }

    /// <summary>
    /// The activity object of SET_ACTIVITY: the cover as large image with the Ruruka icon as its badge.
    /// Discord refuses buttons next to a join secret, so a hosted session trades the button for invites.
    /// </summary>
    public object ToPayload() => new
    {
        type = WatchingType,
        status_display_type = ShowDetailsInStatus,
        details = Details,
        state = State,
        timestamps = StartsAtMs is { } start && EndsAtMs is { } end ? new { start, end } : null,
        assets = new
        {
            large_image = CoverUrl ?? IconUrl,
            large_text = Details,
            small_image = CoverUrl is null ? null : IconUrl,
            small_text = CoverUrl is null ? null : "Ruruka",
        },
        buttons = Invite is null ? new[] { new { label = ButtonLabel, url = $"{OpenPageUrl}{MediaId}" } } : null,
        party = Invite is { } invite ? new { id = PartyId(invite.Code), size = new[] { invite.MemberCount, Math.Max(invite.MemberCount, ShownPartySize) } } : null,
        secrets = Invite is { } joinable ? new { join = joinable.Code } : null,
        instance = Invite is not null,
    };

    // <-- Discord refuse un texte de moins de 2 caractères : un titre comme « K » reçoit un blanc braille -->
    private static string DiscordText(string text)
    {
        if (text.Length > MaxTextLength) return $"{text[..(MaxTextLength - 1)]}…";
        return text.PadRight(2, '⠀');
    }

    // <-- L'identifiant du groupe se voit sur le profil, le code non : il chiffre la séance -->
    private static string PartyId(string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)))[..PartyIdLength];

    private static bool IsAniListImage(string? url) =>
        url is { Length: <= MaxImageUrlLength }
        && Uri.TryCreate(url, UriKind.Absolute, out var address)
        && address.Scheme == Uri.UriSchemeHttps
        && address.Host.EndsWith(".anilist.co", StringComparison.OrdinalIgnoreCase);

    private static string Clock(double seconds)
    {
        var time = TimeSpan.FromSeconds(Math.Max(0, seconds));
        return time.TotalHours >= 1 ? $"{(int)time.TotalHours}:{time:mm\\:ss}" : $"{(int)time.TotalMinutes}:{time:ss}";
    }
}
