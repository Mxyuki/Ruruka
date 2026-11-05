import type { CalendarEvent } from '../../lib/bridge';

const daysPerWeek = 7;

/** A local day as "yyyy-mm-dd", the same text as a date input and the host's events. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (month: Date, months: number) => new Date(month.getFullYear(), month.getMonth() + months, 1);

export const unixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

/** Every day shown for a month: whole weeks from Monday, so the first and last rows overflow it. */
export function monthGrid(month: Date): Date[] {
  const weekdayFromMonday = (month.getDay() + 6) % daysPerWeek;
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cellCount = Math.ceil((weekdayFromMonday + lastDay.getDate()) / daysPerWeek) * daysPerWeek;
  return Array.from({ length: cellCount }, (_, index) => addDays(month, index - weekdayFromMonday));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const formatMonth = (month: Date) => capitalize(month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));

export const formatDay = (date: Date) => capitalize(date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));

export const formatShortDay = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export const formatWeekday = (date: Date) => date.toLocaleDateString('fr-FR', { weekday: 'long' });

export const formatAiringTime = (airingAt: number) =>
  new Date(airingAt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export interface EpisodeRange {
  first: number;
  last: number;
}

/** The episodes planned for one occurrence of an event, or null without a goal or past the end of the anime. */
export function episodesForOccurrence(anime: CalendarEvent['anime'], occurrence: number): EpisodeRange | null {
  if (!anime || anime.episodesPerSession <= 0) return null;
  const first = anime.firstEpisode + occurrence * anime.episodesPerSession;
  const last = first + anime.episodesPerSession - 1;
  const total = anime.totalEpisodes ?? Infinity;
  return first > total ? null : { first, last: Math.min(last, total) };
}

export const formatEpisodes = ({ first, last }: EpisodeRange) => (first === last ? `ép. ${first}` : `ép. ${first} à ${last}`);

export interface EventOccurrence {
  event: CalendarEvent;
  date: Date;
  /** 0 for the first week. */
  index: number;
}

/** The weeks of an event that fall between two days, both included. */
export function occurrencesBetween(event: CalendarEvent, firstDay: Date, lastDay: Date): EventOccurrence[] {
  const start = dateFromKey(event.date);
  const occurrences: EventOccurrence[] = [];
  for (let index = 0; index < event.repeatWeeks; index++) {
    const date = addDays(start, index * daysPerWeek);
    if (date > lastDay) break;
    if (date >= firstDay) occurrences.push({ event, date, index });
  }
  return occurrences;
}
