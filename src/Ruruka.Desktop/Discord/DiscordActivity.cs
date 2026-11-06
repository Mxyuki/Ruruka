using System.Security.Cryptography;
using System.Text;

namespace Ruruka.Desktop.Discord;

/// <summary>The session this PC hosts: friends invited from Discord receive its code.</summary>
internal sealed record SessionInvite(string Code, int MemberCount);

/// <summary>Payload of "discord.joinAsked": someone asked to join the hosted session from Discord.</summary>
internal sealed record JoinAsked(string UserId, string Name);

/// <summary>The session's episode as a friend follows it, for instance on the host's Discord screen share.</summary>
internal sealed record SessionEpisode(int MediaId, int Episode, string Title, string? CoverUrl, double PositionSeconds, double DurationSeconds)
{
    public NowWatching ToNowWatching() => new(MediaId, Episode, Title, CoverUrl, PositionSeconds, DurationSeconds, false);
}

/// <summary>What the Ruruka player shows right now.</summary>
internal sealed record NowWatching(int MediaId, int Episode, string Title, string? CoverUrl, double PositionSeconds, double DurationSeconds, bool IsPaused);

/// <summary>A Discord activity: Watching with its time bar during an episode, or Playing while a session waits for friends.</summary>
internal sealed record DiscordActivity(int MediaId, string Details, string State, string? CoverUrl, long? StartsAtMs, long? EndsAtMs, SessionInvite? Invite = null, string? Companions = null)
{
    internal const string IconUrl = "https://raw.githubusercontent.com/Mxyuki/Ruruka/main/assets/icon.png";

    // Discord only accepts http(s) buttons, so a page opens ruruka:// or falls back to AniList.
    internal const string OpenPageUrl = "https://mxyuki.github.io/Ruruka/open/?media=";

    private const int WatchingType = 3;

    // Discord accepts a join secret on a Watching activity but only offers invitations for Playing.
    private const int PlayingType = 0;
    private const int ShowDetailsInStatus = 2;
    private const int MaxTextLength = 128;
    private const int MaxImageUrlLength = 256;
    private const string ButtonLabel = "Ouvrir dans Ruruka";

    // Discord wants a group size; sessions have no real limit, so a larger one simply raises it.
    private const int ShownPartySize = 10;
    private const int PartyIdLength = 16;

    // Two points of the same stretch land slightly apart; only a seek or another speed moves the end this far.
    private const long DriftToleranceMs = 4000;

    /// <summary>What Discord should show: an episode always wins, so invitations only exist while a session waits.</summary>
    public static DiscordActivity? ForNow(NowWatching? watching, SessionInvite? invite, string? companions, DateTimeOffset now)
    {
        if (watching is not null) return From(watching, now, companions);
        return invite is null ? null : ForOpenSession(invite, companions);
    }

    /// <summary>The hover text naming the others in the session, within Discord's text limit; null when alone.</summary>
    public static string? DescribeCompanions(IReadOnlyList<string> names)
    {
        if (names.Count == 0) return null;
        for (var shownCount = names.Count; shownCount >= 1; shownCount--)
        {
            var text = $"Avec {ListNames(names, shownCount)}";
            if (text.Length <= MaxTextLength) return text;
        }
        return "Avec d'autres détectives";
    }

    /// <summary>A hosted session with nothing playing, so friends can be invited.</summary>
    public static DiscordActivity ForOpenSession(SessionInvite invite, string? companions = null) =>
        new(0, "Séance Ruruka", "Séance ouverte", null, null, null, invite, companions);

    public static DiscordActivity From(NowWatching watching, DateTimeOffset now, string? companions = null)
    {
        var episode = $"Épisode {watching.Episode}";
        var details = DiscordText(watching.Title);
        var cover = IsAniListImage(watching.CoverUrl) ? watching.CoverUrl : null;
        var hasDuration = watching.DurationSeconds > 0;
        if (watching.IsPaused)
        {
            var pausedAt = hasDuration ? $" à {Clock(watching.PositionSeconds)} / {Clock(watching.DurationSeconds)}" : "";
            return new DiscordActivity(watching.MediaId, details, $"{episode} · En pause{pausedAt}", cover, null, null, null, companions);
        }
        if (!hasDuration) return new DiscordActivity(watching.MediaId, details, episode, cover, null, null, null, companions);

        var startsAt = now.AddSeconds(-watching.PositionSeconds);
        var endsAt = startsAt.AddSeconds(watching.DurationSeconds);
        return new DiscordActivity(watching.MediaId, details, episode, cover, startsAt.ToUnixTimeMilliseconds(), endsAt.ToUnixTimeMilliseconds(), null, companions);
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
    /// Discord refuses buttons next to a join secret, so a waiting session trades the button for invites.
    /// </summary>
    public object ToPayload() => new
    {
        type = Invite is null ? WatchingType : PlayingType,
        status_display_type = ShowDetailsInStatus,
        details = Details,
        state = State,
        timestamps = StartsAtMs is { } start && EndsAtMs is { } end ? new { start, end } : null,
        assets = new
        {
            large_image = CoverUrl ?? IconUrl,
            large_text = CoverUrl is null ? Companions ?? Details : Details,
            small_image = CoverUrl is null ? null : IconUrl,
            small_text = CoverUrl is null ? null : Companions ?? "Ruruka",
        },
        buttons = Invite is null ? new[] { new { label = ButtonLabel, url = $"{OpenPageUrl}{MediaId}" } } : null,
        party = Invite is { } invite ? new { id = PartyId(invite.Code), size = new[] { invite.MemberCount, Math.Max(invite.MemberCount, ShownPartySize) } } : null,
        secrets = Invite is { } joinable ? new { join = joinable.Code } : null,
        instance = Invite is not null,
    };

    private static string ListNames(IReadOnlyList<string> names, int shownCount)
    {
        var shown = names.Take(shownCount).ToList();
        var hiddenCount = names.Count - shownCount;
        if (hiddenCount > 0) return $"{string.Join(", ", shown)} et {hiddenCount} {(hiddenCount == 1 ? "autre" : "autres")}";
        return shown.Count == 1 ? shown[0] : $"{string.Join(", ", shown.SkipLast(1))} et {shown[^1]}";
    }

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
