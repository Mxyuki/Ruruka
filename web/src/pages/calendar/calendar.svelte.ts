import { fetchAiredEpisodes, fetchAiringPlans, fetchMediaSummaries } from '../../api/queries/media';
import type { AiringEpisode, FuzzyDate, ListEntry, MediaSummary } from '../../api/types';
import { invoke, type CalendarEvent } from '../../lib/bridge';
import { mediaList } from '../../state/mediaList.svelte';
import { forecastEpisodes } from './airingForecast';
import { addDays, dayKey, episodesForOccurrence, occurrencesBetween, unixSeconds, type EpisodeRange } from './calendarDates';

// <-- Trois semaines de plus que la grille : assez d'épisodes passés pour lire le rythme d'une série -->
const cadenceLookbackDays = 21;
const summaryChunk = 50;
const minutesPerDay = 24 * 60;

export interface AiringItem {
  kind: 'airing';
  id: string;
  media: MediaSummary;
  episode: number;
  airingAt: number;
  isEstimated: boolean;
  isDateOnly: boolean;
  /** A planned anime, shown for its first episode only. */
  isPlanned: boolean;
  isWatched: boolean;
  sortMinute: number;
}

export interface EventItem {
  kind: 'event';
  id: string;
  event: CalendarEvent;
  /** 0 for the first week. */
  occurrence: number;
  episodes: EpisodeRange | null;
  sortMinute: number;
}

export type CalendarItem = AiringItem | EventItem;

interface MediaSchedule {
  knownEpisodes: AiringEpisode[];
  startDate: FuzzyDate | null;
}

const isWatching = ({ status }: ListEntry) => status === 'CURRENT' || status === 'REPEATING';

const isAwaited = ({ status, media }: ListEntry) => status === 'PLANNING' && (media.status === 'RELEASING' || media.status === 'NOT_YET_RELEASED');

const isStillAiring = ({ media }: ListEntry) => media.status !== 'FINISHED' && media.status !== 'CANCELLED';

// <-- Un anime masqué qui ne sortira plus n'a plus rien à faire dans la liste -->
const hasNoMoreEpisodes = (media: MediaSummary | undefined, entry: ListEntry | undefined) =>
  !media || media.status === 'FINISHED' || media.status === 'CANCELLED' || entry?.status === 'COMPLETED';

function minuteOfDay(airingAt: number): number {
  const date = new Date(airingAt * 1000);
  return date.getHours() * 60 + date.getMinutes();
}

function minuteFromTime(time: string | null): number {
  const [hours, minutes] = (time ?? '').split(':').map(Number);
  return hours === undefined || minutes === undefined ? minutesPerDay : hours * 60 + minutes;
}

function mergeKnownEpisodes(...sources: AiringEpisode[][]): AiringEpisode[] {
  const byEpisode = new Map(sources.flat().map(({ episode, airingAt }) => [episode, { episode, airingAt }]));
  return [...byEpisode.values()].sort((a, b) => a.airingAt - b.airingAt);
}

function groupByMedia(airings: (AiringEpisode & { mediaId: number })[]): Map<number, AiringEpisode[]> {
  const grouped = new Map<number, AiringEpisode[]>();
  for (const airing of airings) grouped.set(airing.mediaId, [...(grouped.get(airing.mediaId) ?? []), airing]);
  return grouped;
}

/** Personal events, hidden anime and airing dates of the calendar page; it stays filled between visits. */
class CalendarStore {
  events = $state.raw<CalendarEvent[]>([]);
  hiddenMediaIds = $state.raw<number[]>([]);
  isLoadingSchedule = $state(false);
  scheduleError = $state<string | null>(null);
  private schedules = $state.raw<Map<number, MediaSchedule>>(new Map());
  private offListMedia = $state.raw<Map<number, MediaSummary>>(new Map());

  /** Hidden anime with what the hidden list shows, the ones not loaded yet left out. */
  hiddenMedia: MediaSummary[] = $derived(
    this.hiddenMediaIds.flatMap((id) => {
      const media = mediaList.entryFor(id)?.media ?? this.offListMedia.get(id);
      return media ? [media] : [];
    }),
  );

  /** Reads the saved events, then asks AniList for the dates; `firstDay` is the first day the calendar can show. */
  async load(firstDay: Date): Promise<void> {
    const saved = await invoke('calendar.get');
    this.events = saved.events;
    this.hiddenMediaIds = saved.hiddenMediaIds;
    await this.loadAiringData(firstDay);
  }

  async loadAiringData(firstDay: Date): Promise<void> {
    this.isLoadingSchedule = true;
    this.scheduleError = null;
    try {
      await mediaList.load('ANIME');
      await mediaList.refreshIfAired('ANIME');
      await Promise.all([this.loadSchedules(firstDay), this.forgetFinishedMedia()]);
    } catch (error) {
      this.scheduleError = error instanceof Error ? error.message : String(error);
    } finally {
      this.isLoadingSchedule = false;
    }
  }

  async hide(mediaId: number): Promise<void> {
    await invoke('calendar.hideMedia', { mediaId });
    this.hiddenMediaIds = [...this.hiddenMediaIds, mediaId];
  }

  async show(mediaId: number): Promise<void> {
    await invoke('calendar.showMedia', { mediaIds: [mediaId] });
    this.hiddenMediaIds = this.hiddenMediaIds.filter((id) => id !== mediaId);
  }

  async saveEvent(event: CalendarEvent): Promise<void> {
    await invoke('calendar.saveEvent', event);
    this.events = [...this.events.filter(({ id }) => id !== event.id), event];
  }

  async removeEvent(id: string): Promise<void> {
    await invoke('calendar.removeEvent', { id });
    this.events = this.events.filter((event) => event.id !== id);
  }

  /** What each day between two dates holds, by `dayKey`, in the order of the day. */
  itemsByDay(firstDay: Date, lastDay: Date): Map<string, CalendarItem[]> {
    const items = new Map<string, CalendarItem[]>();
    const add = (date: Date, item: CalendarItem) => items.set(dayKey(date), [...(items.get(dayKey(date)) ?? []), item]);

    for (const { date, item } of this.airingItems(firstDay, lastDay)) add(date, item);
    for (const event of this.events) {
      for (const { date, index } of occurrencesBetween(event, firstDay, lastDay)) {
        const episodes = episodesForOccurrence(event.anime, index);
        add(date, { kind: 'event', id: `${event.id}:${index}`, event, occurrence: index, episodes, sortMinute: minuteFromTime(event.time) });
      }
    }
    for (const dayItems of items.values()) dayItems.sort((a, b) => a.sortMinute - b.sortMinute);
    return items;
  }

  private airingItems(firstDay: Date, lastDay: Date): { date: Date; item: AiringItem }[] {
    const nowSeconds = unixSeconds(new Date());
    const fromSeconds = unixSeconds(firstDay);
    const toSeconds = unixSeconds(addDays(lastDay, 1)) - 1;
    const hidden = new Set(this.hiddenMediaIds);

    return mediaList
      .list('ANIME')
      .filter((entry) => !hidden.has(entry.mediaId) && (isWatching(entry) || isAwaited(entry)))
      .flatMap((entry) => {
        const schedule = this.schedules.get(entry.mediaId);
        const nextEpisode = entry.media.nextAiringEpisode;
        const episodes = forecastEpisodes({
          status: entry.media.status,
          totalEpisodes: entry.media.episodes,
          knownEpisodes: mergeKnownEpisodes(schedule?.knownEpisodes ?? [], nextEpisode ? [nextEpisode] : []),
          startDate: schedule?.startDate ?? null,
          fromSeconds,
          toSeconds,
          nowSeconds,
        });
        const isPlanned = !isWatching(entry);
        return episodes
          .filter(({ episode }) => !isPlanned || episode === 1)
          .map(({ episode, airingAt, isEstimated, isDateOnly }) => ({
            date: new Date(airingAt * 1000),
            item: {
              kind: 'airing' as const,
              id: `${entry.mediaId}:${episode}`,
              media: entry.media,
              episode,
              airingAt,
              isEstimated,
              isDateOnly,
              isPlanned,
              isWatched: entry.progress >= episode,
              sortMinute: isDateOnly ? minutesPerDay : minuteOfDay(airingAt),
            },
          }));
      });
  }

  private async loadSchedules(firstDay: Date): Promise<void> {
    const entries = mediaList.list('ANIME');
    const watched = entries.filter(isWatching);
    const awaited = entries.filter(isAwaited);
    const fromSeconds = unixSeconds(addDays(firstDay, -cadenceLookbackDays));

    const [plans, aired, firstEpisodes] = await Promise.all([
      fetchAiringPlans([...watched.filter(isStillAiring), ...awaited.filter(({ media }) => media.status === 'NOT_YET_RELEASED')].map(({ mediaId }) => mediaId)),
      fetchAiredEpisodes(watched.map(({ mediaId }) => mediaId), fromSeconds),
      fetchAiredEpisodes(awaited.filter(({ media }) => media.status === 'RELEASING').map(({ mediaId }) => mediaId), fromSeconds, 1),
    ]);

    const airedByMedia = groupByMedia([...aired, ...firstEpisodes]);
    const plansByMedia = new Map(plans.map((plan) => [plan.id, plan]));
    this.schedules = new Map(
      entries.map(({ mediaId }) => {
        const plan = plansByMedia.get(mediaId);
        const knownEpisodes = mergeKnownEpisodes(airedByMedia.get(mediaId) ?? [], plan?.airingSchedule.nodes ?? []);
        return [mediaId, { knownEpisodes, startDate: plan?.startDate ?? null }];
      }),
    );
  }

  private async fetchOffListMedia(): Promise<Map<number, MediaSummary>> {
    const missingIds = this.hiddenMediaIds.filter((id) => !mediaList.entryFor(id));
    const fetched: MediaSummary[] = [];
    for (let start = 0; start < missingIds.length; start += summaryChunk) {
      fetched.push(...(await fetchMediaSummaries(missingIds.slice(start, start + summaryChunk))));
    }
    return new Map(fetched.map((media) => [media.id, media]));
  }

  private async forgetFinishedMedia(): Promise<void> {
    const offList = await this.fetchOffListMedia();
    this.offListMedia = offList;
    const finishedIds = this.hiddenMediaIds.filter((id) => {
      const entry = mediaList.entryFor(id);
      return hasNoMoreEpisodes(entry?.media ?? offList.get(id), entry);
    });
    if (!finishedIds.length) return;
    await invoke('calendar.showMedia', { mediaIds: finishedIds });
    this.hiddenMediaIds = this.hiddenMediaIds.filter((id) => !finishedIds.includes(id));
  }
}

export const calendar = new CalendarStore();
