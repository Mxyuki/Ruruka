namespace Ruruka.Desktop.Discord;

/// <summary>What the Ruruka player shows right now.</summary>
internal sealed record NowWatching(int MediaId, int Episode, string Title, string? CoverUrl, double PositionSeconds, double DurationSeconds, bool IsPaused);

/// <summary>A Discord "Watching" activity; start and end times make Discord draw its time bar.</summary>
internal sealed record DiscordActivity(int MediaId, string Details, string State, string? CoverUrl, long? StartsAtMs, long? EndsAtMs)
{
    internal const string IconUrl = "https://raw.githubusercontent.com/Mxyuki/Ruruka/main/assets/icon.png";

    // Discord only accepts http(s) buttons, so a page opens ruruka:// or falls back to AniList.
    internal const string OpenPageUrl = "https://mxyuki.github.io/Ruruka/open/?media=";

    private const int WatchingType = 3;
    private const int ShowDetailsInStatus = 2;
    private const int MaxTextLength = 128;
    private const int MaxImageUrlLength = 256;
    private const string ButtonLabel = "Ouvrir dans Ruruka";

    // Two points of the same stretch land slightly apart; only a seek or another speed moves the end this far.
    private const long DriftToleranceMs = 4000;

    public static DiscordActivity From(NowWatching watching, DateTimeOffset now)
    {
        var episode = $"Épisode {watching.Episode}";
        var details = DiscordText(watching.Title);
        var cover = IsAniListImage(watching.CoverUrl) ? watching.CoverUrl : null;
        var hasDuration = watching.DurationSeconds > 0;
        if (watching.IsPaused)
        {
            var pausedAt = hasDuration ? $" à {Clock(watching.PositionSeconds)} / {Clock(watching.DurationSeconds)}" : "";
            return new DiscordActivity(watching.MediaId, details, $"{episode} · En pause{pausedAt}", cover, null, null);
        }
        if (!hasDuration) return new DiscordActivity(watching.MediaId, details, episode, cover, null, null);

        var startsAt = now.AddSeconds(-watching.PositionSeconds);
        var endsAt = startsAt.AddSeconds(watching.DurationSeconds);
        return new DiscordActivity(watching.MediaId, details, episode, cover, startsAt.ToUnixTimeMilliseconds(), endsAt.ToUnixTimeMilliseconds());
    }

    /// <summary>Whether Discord already shows this, so the update can be skipped (5 updates per 20 s at most).</summary>
    public bool LooksLike(DiscordActivity? shown)
    {
        if (shown is null) return false;
        if (this with { StartsAtMs = shown.StartsAtMs, EndsAtMs = shown.EndsAtMs } != shown) return false;
        if (EndsAtMs is not { } endsAt || shown.EndsAtMs is not { } shownEnd) return EndsAtMs == shown.EndsAtMs;
        return Math.Abs(endsAt - shownEnd) <= DriftToleranceMs;
    }

    /// <summary>The activity object of SET_ACTIVITY: the cover as large image with the Ruruka icon as its badge.</summary>
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
        buttons = new[] { new { label = ButtonLabel, url = $"{OpenPageUrl}{MediaId}" } },
        instance = false,
    };

    // <-- Discord refuse un texte de moins de 2 caractères : un titre comme « K » reçoit un blanc braille -->
    private static string DiscordText(string text)
    {
        if (text.Length > MaxTextLength) return $"{text[..(MaxTextLength - 1)]}…";
        return text.PadRight(2, '⠀');
    }

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
