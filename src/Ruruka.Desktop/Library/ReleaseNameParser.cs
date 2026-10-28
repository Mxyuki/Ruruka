using System.Text;
using System.Text.RegularExpressions;

namespace Ruruka.Desktop.Library;

/// <summary>Extracts series titles and episode numbers from fansub / scene release names.</summary>
internal static partial class ReleaseNameParser
{
    public static string CleanTitle(string folderName)
    {
        var name = BracketGroup().Replace(Normalize(folderName), " ");
        name = name.Replace('_', ' ');
        if (!name.Contains(' ')) name = SceneGroupSuffix().Replace(name, "").Replace('.', ' ');

        name = NoiseToken().Replace(name, " ");
        name = EpisodeRangeSuffix().Replace(name, " ");
        name = FirstSeason().Replace(name, " ");
        name = ShortSeason().Replace(name, match => $" Season {ParseDigits(match.Groups[1].Value)} ");

        return TrimSeparators(Whitespace().Replace(name, " "));
    }

    /// <summary>
    /// Title for a season folder inside a collection. Generic names ("Season 2", "S03") and short
    /// names that don't mention the series ("StrikerS") borrow the collection's title.
    /// </summary>
    public static string CleanSeasonTitle(string collectionFolderName, string seasonFolderName)
    {
        var collectionTitle = CleanTitle(collectionFolderName);
        var seasonTitle = CleanTitle(seasonFolderName);
        if (seasonTitle.Length == 0) return collectionTitle;

        var genericSeason = GenericSeasonName().Match(seasonTitle);
        if (genericSeason.Success)
        {
            var number = ParseDigits(genericSeason.Groups.Cast<Group>().Skip(1).First(group => group.Success).Value);
            return number == 1 ? collectionTitle : $"{collectionTitle} Season {number}";
        }

        var mentionsSeries = collectionTitle
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Any(word => word.Length >= 4 && seasonTitle.Contains(word, StringComparison.OrdinalIgnoreCase));
        return mentionsSeries ? seasonTitle : $"{collectionTitle} {seasonTitle}";
    }

    /// <summary>Returns the episode number, or null for extras (OP/ED, previews) and unrecognised names.</summary>
    public static int? ParseEpisode(string fileName)
    {
        var name = Normalize(Path.GetFileNameWithoutExtension(fileName));
        if (ExtraMarker().IsMatch(name)) return null;

        foreach (var pattern in EpisodePatterns)
        {
            var match = pattern.Match(name);
            if (match.Success) return ParseDigits(match.Groups[1].Value);
        }

        var stripped = BracketGroup().Replace(name, " ");
        stripped = NoiseToken().Replace(stripped, " ");
        stripped = DecimalNumber().Replace(stripped, " ");
        var lastNumber = StandaloneNumber().Matches(stripped).LastOrDefault();
        return lastNumber is null ? null : ParseDigits(lastNumber.Groups[1].Value);
    }

    // Japanese releases often use full-width characters ("Ｓ０２", "第１話"); NFKC turns them into plain ASCII.
    private static string Normalize(string name) => name.Normalize(NormalizationForm.FormKC);

    // \d also matches other scripts' digits (Arabic-Indic, Devanagari…), which int.Parse rejects.
    private static int ParseDigits(string digits) =>
        digits.Aggregate(0, (number, digit) => number * 10 + (int)char.GetNumericValue(digit));

    private static string TrimSeparators(string value) => value.Trim(' ', '-', '–', '~', ':', '+');

    private static readonly Regex[] EpisodePatterns =
    [
        SeasonEpisode(),
        EpisodeKeyword(),
        DashEpisode(),
        BracketEpisode(),
    ];

    [GeneratedRegex(@"\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|【[^】]*】")]
    private static partial Regex BracketGroup();

    [GeneratedRegex(@"\b(?:\d{3,4}p|4k|[xh]\.?26[45]|hevc|avc|av1|10-?bit|8-?bit|hdr|bd(?:rip)?|blu-?ray|web(?:-?dl|-?rip)?|dual[ -]audio|multi[ -]?subs?|batch|complete|flac|aac|opus|eac3|ddp?\d?\.?\d?|remux|uncensored|collection|franchise|all seasons)\b", RegexOptions.IgnoreCase)]
    private static partial Regex NoiseToken();

    [GeneratedRegex(@"\s[-–~]?\s*\d{1,4}\s*[-~]\s*\d{1,4}\s*$")]
    private static partial Regex EpisodeRangeSuffix();

    [GeneratedRegex(@"\b(?:S0?1|Season 0?1|1st Season)\b", RegexOptions.IgnoreCase)]
    private static partial Regex FirstSeason();

    [GeneratedRegex(@"\bS(\d{1,2})\b", RegexOptions.IgnoreCase)]
    private static partial Regex ShortSeason();

    // Scene names end with "-GROUP" ("Show.S02.1080p.WEB-GROUP").
    [GeneratedRegex(@"-[A-Za-z0-9]+$")]
    private static partial Regex SceneGroupSuffix();

    // CleanTitle has already rewritten "S2" as "Season 2" by the time this runs.
    [GeneratedRegex(@"^(?:(?:Season|Saison|Part|Cour)\s*(\d+)|(\d+)(?:st|nd|rd|th) Season|(\d+))$", RegexOptions.IgnoreCase)]
    private static partial Regex GenericSeasonName();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"\b(?:NC ?(?:OP|ED)\d*|Creditless|Trailer|Preview|Menu|Teaser|(?:OP|ED|PV|CM)\s?\d{0,2})\b", RegexOptions.IgnoreCase)]
    private static partial Regex ExtraMarker();

    [GeneratedRegex(@"\bS\d{1,2}\s?E(\d{1,4})(?:v\d)?\b", RegexOptions.IgnoreCase)]
    private static partial Regex SeasonEpisode();

    [GeneratedRegex(@"\b(?:EP?\.?|Episode)\s?(\d{1,4})(?:v\d)?\b", RegexOptions.IgnoreCase)]
    private static partial Regex EpisodeKeyword();

    [GeneratedRegex(@"\s[-–]\s(\d{1,4})(?:v\d)?(?=\s|\[|\(|$)")]
    private static partial Regex DashEpisode();

    [GeneratedRegex(@"\[(\d{1,4})(?:v\d)?\]")]
    private static partial Regex BracketEpisode();

    [GeneratedRegex(@"\d+\.\d+")]
    private static partial Regex DecimalNumber();

    // Up to three digits so four-digit years are never read as episode numbers.
    [GeneratedRegex(@"(?<!\d)(\d{1,3})(?:v\d)?(?!\d)")]
    private static partial Regex StandaloneNumber();
}
