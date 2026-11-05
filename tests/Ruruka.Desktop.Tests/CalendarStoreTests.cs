using Ruruka.Desktop.Calendar;

namespace Ruruka.Desktop.Tests;

public sealed class CalendarStoreTests : IDisposable
{
    private readonly string _root = Directory.CreateTempSubdirectory("ruruka-calendar-").FullName;

    private string FilePath => Path.Combine(_root, "calendar.json");

    public void Dispose() => Directory.Delete(_root, recursive: true);

    [Fact]
    public void MissingFile_StartsEmpty()
    {
        var store = new CalendarStore(FilePath);

        Assert.Empty(store.Current.Events);
        Assert.Empty(store.Current.HiddenMediaIds);
    }

    [Fact]
    public void SaveEvent_WithAnExistingId_ReplacesIt()
    {
        var store = new CalendarStore(FilePath);

        store.SaveEvent(EventNamed("rattrapage", "Première version"));
        store.SaveEvent(EventNamed("rattrapage", "Seconde version"));

        var saved = Assert.Single(store.Current.Events);
        Assert.Equal("Seconde version", saved.Title);
    }

    [Fact]
    public void RemoveEvent_LeavesTheOthers()
    {
        var store = new CalendarStore(FilePath);
        store.SaveEvent(EventNamed("garde", "Gardé"));
        store.SaveEvent(EventNamed("retire", "Retiré"));

        store.RemoveEvent("retire");

        Assert.Equal("garde", Assert.Single(store.Current.Events).Id);
    }

    [Fact]
    public void HideMedia_Twice_KeepsOneId()
    {
        var store = new CalendarStore(FilePath);

        store.HideMedia(235);
        store.HideMedia(235);

        Assert.Equal([235], store.Current.HiddenMediaIds);
    }

    [Fact]
    public void ShowMedia_RemovesEveryGivenId()
    {
        var store = new CalendarStore(FilePath);
        store.HideMedia(235);
        store.HideMedia(21);
        store.HideMedia(966);

        store.ShowMedia([235, 966]);

        Assert.Equal([21], store.Current.HiddenMediaIds);
    }

    [Fact]
    public void SavedData_SurvivesARestart()
    {
        var store = new CalendarStore(FilePath);
        var anime = new CalendarEventAnime(235, "Meitantei Conan", "https://img.example/conan.jpg", null, 7, 3);
        store.SaveEvent(EventNamed("rythme", "Mon rythme") with { Anime = anime, RepeatWeeks = 4 });
        store.HideMedia(21);

        var reopened = new CalendarStore(FilePath);

        var saved = Assert.Single(reopened.Current.Events);
        Assert.Equal(anime, saved.Anime);
        Assert.Equal(4, saved.RepeatWeeks);
        Assert.Equal([21], reopened.Current.HiddenMediaIds);
    }

    [Fact]
    public void UnreadableFile_StartsEmpty()
    {
        File.WriteAllText(FilePath, "{ pas du json");

        var store = new CalendarStore(FilePath);

        Assert.Empty(store.Current.Events);
    }

    private static CalendarEvent EventNamed(string id, string title) =>
        new(id, title, "2026-11-05", null, "", 1, null);
}
