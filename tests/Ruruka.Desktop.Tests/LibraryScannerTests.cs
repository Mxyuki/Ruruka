using Ruruka.Desktop.Library;

namespace Ruruka.Desktop.Tests;

public sealed class LibraryScannerTests : IDisposable
{
    private readonly string _root = Directory.CreateTempSubdirectory("ruruka-library-").FullName;

    public void Dispose() => Directory.Delete(_root, recursive: true);

    [Fact]
    public void PlainSeriesFolder_IsOneSeries()
    {
        AddVideo("Sousou no Frieren", "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv");
        AddVideo("Sousou no Frieren", "[SubsPlease] Sousou no Frieren - 02 (1080p).mkv");

        var folder = Assert.Single(LibraryScanner.Scan(_root));

        Assert.Equal("Sousou no Frieren", folder.Name);
        Assert.Equal([1, 2], folder.Episodes.Select(episode => episode.Number));
    }

    [Fact]
    public void CollectionFolder_SplitsIntoOneSeriesPerSeason()
    {
        AddVideo("Nanoha Collection/Mahou Shoujo Lyrical Nanoha", "Nanoha - 01.mkv");
        AddVideo("Nanoha Collection/Mahou Shoujo Lyrical Nanoha A's", "Nanoha A's - 01.mkv");
        AddVideo("Nanoha Collection/StrikerS", "StrikerS - 01.mkv");

        var folders = LibraryScanner.Scan(_root);

        Assert.Equal(
            ["Mahou Shoujo Lyrical Nanoha", "Mahou Shoujo Lyrical Nanoha A's", "Nanoha StrikerS"],
            folders.Select(folder => folder.GuessedTitle));
        Assert.All(folders, folder => Assert.StartsWith("Nanoha Collection/", folder.Name));
    }

    [Fact]
    public void GenericSeasonFolders_BorrowTheSeriesTitle()
    {
        AddVideo("Spy x Family/Season 1", "Spy x Family - 01.mkv");
        AddVideo("Spy x Family/S2", "Spy x Family S2 - 01.mkv");

        var folders = LibraryScanner.Scan(_root);

        Assert.Equal(["Spy x Family", "Spy x Family Season 2"], folders.Select(folder => folder.GuessedTitle).Order());
    }

    [Fact]
    public void SingleSeasonSubfolder_StaysOneSeries()
    {
        AddVideo("Dungeon Meshi/Season 1", "Dungeon Meshi - 01.mkv");

        var folder = Assert.Single(LibraryScanner.Scan(_root));

        Assert.Equal("Dungeon Meshi", folder.Name);
    }

    [Fact]
    public void FolderWithOwnEpisodesAndExtrasFolder_StaysOneSeries()
    {
        AddVideo("Bocchi the Rock", "Bocchi the Rock - 01.mkv");
        AddVideo("Bocchi the Rock/Extras", "NCOP.mkv");
        AddVideo("Bocchi the Rock/Specials", "Special 01.mkv");

        var folder = Assert.Single(LibraryScanner.Scan(_root));

        Assert.Equal("Bocchi the Rock", folder.Name);
    }

    private void AddVideo(string folder, string fileName)
    {
        var directory = Directory.CreateDirectory(Path.Combine(_root, folder));
        File.WriteAllBytes(Path.Combine(directory.FullName, fileName), []);
    }
}
