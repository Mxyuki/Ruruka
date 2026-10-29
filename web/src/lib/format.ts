import type { FuzzyDate, MediaListStatus, MediaSeason, MediaSummary, MediaType, ScoreFormat } from '../api/types';

const enumAcronyms = new Set(['TV', 'OVA', 'ONA']);
const enumLabels: Record<string, string> = {
  NOVEL: 'Light novel', TV_SHORT: 'TV court', NOT_YET_RELEASED: 'Pas encore sorti', FINISHED: 'Terminé', RELEASING: 'En diffusion',
  CANCELLED: 'Annulé', HIATUS: 'En pause', MOVIE: 'Film', SPECIAL: 'Spécial', MUSIC: 'Clip', ONE_SHOT: 'One shot',
  WINTER: 'Hiver', SPRING: 'Printemps', SUMMER: 'Été', FALL: 'Automne',
};

/** Turns AniList enum values into labels: "LIGHT_NOVEL" → "Light Novel". */
export function formatEnum(value: string | null | undefined): string {
  if (!value) return '';
  return enumLabels[value] ?? value
    .split('_')
    .map((word) => (enumAcronyms.has(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(' ');
}

/** What kind of work a media is: "Anime", "Film", "Manga", "Light novel"… */
export function formatContentKind(media: Pick<MediaSummary, 'type' | 'format'>): string {
  const isSeries = media.format === 'TV' || media.format === 'TV_SHORT';
  if (media.type === 'ANIME' && (isSeries || !media.format)) return 'Anime';
  return formatEnum(media.format ?? media.type);
}

const statusLabels: Record<MediaType, Record<MediaListStatus, string>> = {
  ANIME: { CURRENT: 'En cours', PLANNING: 'À voir', COMPLETED: 'Résolu', PAUSED: 'En pause', DROPPED: 'Abandonné', REPEATING: 'Je revois' },
  MANGA: { CURRENT: 'En cours', PLANNING: 'À lire', COMPLETED: 'Résolu', PAUSED: 'En pause', DROPPED: 'Abandonné', REPEATING: 'Je relis' },
};

export const formatListStatus = (status: MediaListStatus, type: MediaType = 'ANIME') => statusLabels[type][status];

/** CSS variable holding a list status colour, e.g. CURRENT → var(--statusCurrent). */
export const statusColor = (status: MediaListStatus) => `var(--status${status.charAt(0)}${status.slice(1).toLowerCase()})`;

const seasonLabels: Record<MediaSeason, string> = { WINTER: 'Hiver', SPRING: 'Printemps', SUMMER: 'Été', FALL: 'Automne' };
export const formatSeason = (season: MediaSeason) => seasonLabels[season];

export const unitLabel = (type: MediaType) => (type === 'MANGA' ? 'Chapitre' : 'Épisode');

export const pluralize = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

const compactFormatter = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCompact = (value: number) => compactFormatter.format(value);

export function formatCountdown(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}j ${hours}h`;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** `seconds` as m:ss, or h:mm:ss past an hour. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export function formatFuzzyDate(date: FuzzyDate | null | undefined): string | null {
  if (!date?.year) return null;
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', timeZone: 'UTC' };
  if (date.month) options.month = 'short';
  if (date.month && date.day) options.day = 'numeric';
  return new Date(Date.UTC(date.year, (date.month ?? 1) - 1, date.day ?? 1)).toLocaleDateString('fr-FR', options);
}

export function formatRelativeTime(unixSeconds: number): string {
  const elapsed = Date.now() / 1000 - unixSeconds;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  const formatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (elapsed >= size) return formatter.format(-Math.floor(elapsed / size), unit);
  }
  return "à l'instant";
}

export interface ScoreScale {
  max: number;
  step: number;
}

export const scoreScales: Record<ScoreFormat, ScoreScale> = {
  POINT_100: { max: 100, step: 1 },
  POINT_10_DECIMAL: { max: 10, step: 0.5 },
  POINT_10: { max: 10, step: 1 },
  POINT_5: { max: 5, step: 1 },
  POINT_3: { max: 3, step: 1 },
};

const smileys = ['', '☹', '😐', '☺'];

export function formatUserScore(score: number, format: ScoreFormat): string {
  if (!score) return '–';
  if (format === 'POINT_3') return smileys[score] ?? String(score);
  if (format === 'POINT_5') return '★'.repeat(score);
  return format === 'POINT_10_DECIMAL' ? score.toFixed(1) : String(score);
}

export const todayAsFuzzyDate = (): FuzzyDate => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
};
