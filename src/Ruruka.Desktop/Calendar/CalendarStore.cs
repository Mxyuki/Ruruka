namespace Ruruka.Desktop.Calendar;

/// <summary>
/// An anime attached to a calendar event. <see cref="EpisodesPerSession"/> is the viewer's own pace:
/// 0 attaches the anime without any episode goal.
/// </summary>
public sealed record CalendarEventAnime(
    int MediaId,
    string Title,
    string CoverUrl,
    int? TotalEpisodes,
    int FirstEpisode,
    int EpisodesPerSession);

/// <summary>
/// A personal event. <see cref="Date"/> is the first day (yyyy-MM-dd) and <see cref="RepeatWeeks"/>
/// how many weeks in a row it happens, that first week included.
/// </summary>
public sealed record CalendarEvent(
    string Id,
    string Title,
    string Date,
    string? Time,
    string Notes,
    int RepeatWeeks,
    CalendarEventAnime? Anime);

/// <summary>Everything persisted in calendar.json.</summary>
public sealed record CalendarData(IReadOnlyList<int> HiddenMediaIds, IReadOnlyList<CalendarEvent> Events)
{
    public static CalendarData Empty { get; } = new([], []);
}

/// <summary>Persists personal events and the anime the viewer hid from the calendar.</summary>
public sealed class CalendarStore
{
    private readonly string _path;
    private readonly object _gate = new();
    private CalendarData _data;

    public CalendarStore(string path)
    {
        _path = path;
        _data = JsonDefaults.ReadFile(path, CalendarData.Empty);
    }

    public CalendarData Current
    {
        get { lock (_gate) return _data; }
    }

    /// <summary>Adds the event, or replaces the one with the same id.</summary>
    public void SaveEvent(CalendarEvent calendarEvent) => Update(data => data with
    {
        Events = [.. data.Events.Where(saved => saved.Id != calendarEvent.Id), calendarEvent],
    });

    public void RemoveEvent(string id) => Update(data => data with
    {
        Events = [.. data.Events.Where(saved => saved.Id != id)],
    });

    public void HideMedia(int mediaId) => Update(data => data with
    {
        HiddenMediaIds = [.. data.HiddenMediaIds.Append(mediaId).Distinct()],
    });

    public void ShowMedia(IReadOnlyCollection<int> mediaIds) => Update(data => data with
    {
        HiddenMediaIds = [.. data.HiddenMediaIds.Except(mediaIds)],
    });

    private void Update(Func<CalendarData, CalendarData> change)
    {
        lock (_gate)
        {
            _data = change(_data);
            JsonDefaults.WriteFile(_path, _data);
        }
    }
}
