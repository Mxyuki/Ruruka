namespace Ruruka.Desktop.Library;

public sealed record EpisodeFile(string Path, string FileName, int? Number);

/// <param name="Name">Path relative to the library root ("Nanoha/StrikerS"); also the key for its link.</param>
public sealed record LibraryFolder(string Name, string Path, string GuessedTitle, IReadOnlyList<EpisodeFile> Episodes);

/// <summary>
/// Treats every direct sub-folder of the library root as one series, except collections:
/// folders holding no videos themselves but several sub-folders that do ("Nanoha/" with each
/// season inside). Each of those sub-folders becomes its own series, matching AniList's
/// one-entry-per-season model.
/// </summary>
internal static class LibraryScanner
{
    public static bool IsVideo(string path) => VideoExtensions.Contains(Path.GetExtension(path));

    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mkv", ".mp4", ".avi", ".webm", ".m4v", ".mov", ".wmv", ".ts", ".m2ts", ".flv",
    };

    private const int MinimumCollectionSeasons = 2;

    private static readonly EnumerationOptions DirectChildren = new() { IgnoreInaccessible = true };

    // Covers "Show/Season 2/ep.mkv" layouts without walking arbitrarily deep trees.
    private static readonly EnumerationOptions FileSearch = new()
    {
        RecurseSubdirectories = true,
        MaxRecursionDepth = 3,
        IgnoreInaccessible = true,
    };

    public static IReadOnlyList<LibraryFolder> Scan(string root)
    {
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException($"Library folder not found: {root}");

        return new DirectoryInfo(root)
            .EnumerateDirectories("*", DirectChildren)
            .SelectMany(ScanSeries)
            .Where(folder => folder.Episodes.Count > 0)
            .OrderBy(folder => folder.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private static IEnumerable<LibraryFolder> ScanSeries(DirectoryInfo directory)
    {
        var seasonFolders = directory.EnumerateDirectories("*", DirectChildren).Where(ContainsVideos).ToList();
        var hasOwnVideos = directory.EnumerateFiles("*", DirectChildren).Any(file => IsVideo(file.Name));

        if (hasOwnVideos || seasonFolders.Count < MinimumCollectionSeasons)
        {
            return [ScanFolder(directory, directory.Name, ReleaseNameParser.CleanTitle(directory.Name))];
        }
        return seasonFolders.Select(season => ScanFolder(
            season,
            $"{directory.Name}/{season.Name}",
            ReleaseNameParser.CleanSeasonTitle(directory.Name, season.Name)));
    }

    private static bool ContainsVideos(DirectoryInfo directory) =>
        directory.EnumerateFiles("*", FileSearch).Any(file => IsVideo(file.Name));

    private static LibraryFolder ScanFolder(DirectoryInfo directory, string name, string guessedTitle)
    {
        var episodes = directory
            .EnumerateFiles("*", FileSearch)
            .Where(file => IsVideo(file.Name))
            .Select(file => new EpisodeFile(file.FullName, file.Name, ReleaseNameParser.ParseEpisode(file.Name)))
            .OrderBy(episode => episode.Number ?? int.MaxValue)
            .ThenBy(episode => episode.FileName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        return new LibraryFolder(name, directory.FullName, guessedTitle, episodes);
    }
}
