using System.Globalization;
using Ruruka.Desktop.Calendar;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class CalendarModule(CalendarStore calendar) : IBridgeModule
{
    private const int MaxIdLength = 64;
    private const int MaxTitleLength = 200;
    private const int MaxNotesLength = 4000;
    private const int MaxCoverUrlLength = 500;
    private const int MaxRepeatWeeks = 104;
    private const int MaxEpisode = 100_000;

    public void Register(BridgeRouter router)
    {
        router.Register("calendar.get", () => Task.FromResult(calendar.Current));
        router.Register<CalendarEvent, bool>("calendar.saveEvent", calendarEvent =>
        {
            Validate(calendarEvent);
            calendar.SaveEvent(calendarEvent);
            return Task.FromResult(true);
        });
        router.Register<EventParams, bool>("calendar.removeEvent", parameters =>
        {
            calendar.RemoveEvent(parameters.Id);
            return Task.FromResult(true);
        });
        router.Register<MediaParams, bool>("calendar.hideMedia", parameters =>
        {
            calendar.HideMedia(parameters.MediaId);
            return Task.FromResult(true);
        });
        router.Register<MediaListParams, bool>("calendar.showMedia", parameters =>
        {
            calendar.ShowMedia(parameters.MediaIds);
            return Task.FromResult(true);
        });
    }

    private static void Validate(CalendarEvent calendarEvent)
    {
        if (string.IsNullOrWhiteSpace(calendarEvent.Id) || calendarEvent.Id.Length > MaxIdLength)
        {
            throw new BridgeException("Événement invalide.");
        }
        if (string.IsNullOrWhiteSpace(calendarEvent.Title) || calendarEvent.Title.Length > MaxTitleLength)
        {
            throw new BridgeException($"Le titre doit faire entre 1 et {MaxTitleLength} caractères.");
        }
        if (calendarEvent.Notes.Length > MaxNotesLength)
        {
            throw new BridgeException($"Les notes sont limitées à {MaxNotesLength} caractères.");
        }
        if (!IsExact(calendarEvent.Date, "yyyy-MM-dd"))
        {
            throw new BridgeException("Date invalide.");
        }
        if (calendarEvent.Time is { } time && !IsExact(time, "HH:mm"))
        {
            throw new BridgeException("Heure invalide.");
        }
        if (calendarEvent.RepeatWeeks is < 1 or > MaxRepeatWeeks)
        {
            throw new BridgeException($"Un événement se répète de 1 à {MaxRepeatWeeks} semaines.");
        }
        if (calendarEvent.Anime is { } anime) Validate(anime);
    }

    private static void Validate(CalendarEventAnime anime)
    {
        var hasValidEpisodes = anime.FirstEpisode is >= 1 and <= MaxEpisode && anime.EpisodesPerSession is >= 0 and <= MaxEpisode;
        if (anime.MediaId <= 0 || anime.CoverUrl.Length > MaxCoverUrlLength || !hasValidEpisodes)
        {
            throw new BridgeException("Anime attaché invalide.");
        }
    }

    private static bool IsExact(string value, string format) =>
        DateTime.TryParseExact(value, format, CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    private sealed record EventParams(string Id);

    private sealed record MediaParams(int MediaId);

    private sealed record MediaListParams(IReadOnlyList<int> MediaIds);
}
