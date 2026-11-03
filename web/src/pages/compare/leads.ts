import type { ComparisonEntry } from '../../api/queries/list';
import type { MediaFormat, ScoreFormat } from '../../api/types';
import { excludedNames, requiredNames, type FilterPick } from '../../lib/filterPicks';
import { formatUserScore, scoreScales } from '../../lib/format';
import { indexByMedia, isSeen, strongTagRank, tasteMatch, type TasteProfile } from './tastes';

export type LeadSort = 'match' | 'score' | 'popularity' | 'harmony';

/** Whose titles are shown: the viewer's for the other user, the other way round, or the ones both loved. */
export type LeadMode = 'mine' | 'theirs' | 'shared';

export interface LeadFilters {
  genres: FilterPick[];
  tags: FilterPick[];
  /** In the viewer's score format; 0 keeps unscored titles too. */
  minScore: number;
  /** Keeps titles the other user only plans to watch. */
  includesPlanned: boolean;
  /** Empty keeps every format. */
  formats: MediaFormat[];
  /** Episode (or chapter) count bounds; null for no bound. */
  minUnits: number | null;
  maxUnits: number | null;
  sort: LeadSort;
}

/** A title one user saw and would hand to the other, or one both saw (`otherEntry` set). */
export interface Lead {
  entry: ComparisonEntry;
  otherEntry: ComparisonEntry | null;
  isPlannedByOther: boolean;
  /** How well it fits the other user's tastes (see `tasteMatch`); 0 for shared titles. */
  match: number;
  /** Shared titles: the lower of both 0–100 scores, so only a title both loved ranks high. */
  harmony: number;
}

// <-- Un titre dont on ne connaît pas encore le nombre d'épisodes (en diffusion) sort dès qu'une borne est posée -->
function hasLength(media: ComparisonEntry['media'], filters: LeadFilters): boolean {
  if (!filters.minUnits && !filters.maxUnits) return true;
  const units = media.type === 'MANGA' ? media.chapters : media.episodes;
  if (!units) return false;
  return units >= (filters.minUnits || 0) && units <= (filters.maxUnits || Infinity);
}

function hasPicks(media: ComparisonEntry['media'], filters: LeadFilters): boolean {
  const tagNames = new Set(media.tags.filter((tag) => tag.rank >= strongTagRank).map((tag) => tag.name));
  if (filters.formats.length && !(media.format && filters.formats.includes(media.format))) return false;
  if (!hasLength(media, filters)) return false;
  return (
    requiredNames(filters.genres).every((genre) => media.genres.includes(genre)) &&
    !excludedNames(filters.genres).some((genre) => media.genres.includes(genre)) &&
    requiredNames(filters.tags).every((tag) => tagNames.has(tag)) &&
    !excludedNames(filters.tags).some((tag) => tagNames.has(tag))
  );
}

const sorters: Record<LeadSort, (a: Lead, b: Lead) => number> = {
  match: (a, b) => b.match - a.match || b.entry.score100 - a.entry.score100,
  score: (a, b) => b.entry.score100 - a.entry.score100 || b.match - a.match,
  popularity: (a, b) => (b.entry.media.popularity ?? 0) - (a.entry.media.popularity ?? 0),
  harmony: (a, b) => b.harmony - a.harmony || bothScores(b) - bothScores(a),
};

const bothScores = (lead: Lead) => lead.entry.score100 + (lead.otherEntry?.score100 ?? 0);

/** `owner`'s seen titles that `other` hasn't seen, filtered and sorted. Dropped titles are never suggested. */
export function leadsFor(owner: ComparisonEntry[], other: ComparisonEntry[], otherTastes: TasteProfile, filters: LeadFilters): Lead[] {
  const otherByMedia = indexByMedia(other);
  const leads: Lead[] = [];
  for (const entry of owner) {
    if (!isKept(entry, filters.minScore)) continue;
    const otherEntry = otherByMedia.get(entry.mediaId);
    const isPlannedByOther = otherEntry?.status === 'PLANNING';
    if (otherEntry && !(isPlannedByOther && filters.includesPlanned)) continue;
    if (!hasPicks(entry.media, filters)) continue;
    leads.push({ entry, otherEntry: null, isPlannedByOther, match: tasteMatch(entry.media, otherTastes), harmony: 0 });
  }
  return leads.sort(sorters[filters.sort]);
}

const isKept = (entry: ComparisonEntry, minScore: number) => isSeen(entry) && entry.status !== 'DROPPED' && entry.score >= minScore;

// <-- Classées par la plus basse des deux notes : 10 et 2 donnent 2, 5 et 5 donnent 5, et à égalité la somme départage (10 et 8 avant 8 et 8) -->
/** Titles both users saw, each scored at least `minScore`, filtered and sorted. */
export function sharedLeads(mine: ComparisonEntry[], theirs: ComparisonEntry[], filters: LeadFilters): Lead[] {
  const theirsByMedia = indexByMedia(theirs);
  const leads: Lead[] = [];
  for (const entry of mine) {
    const otherEntry = theirsByMedia.get(entry.mediaId);
    if (!otherEntry || !isKept(entry, filters.minScore) || !isKept(otherEntry, filters.minScore)) continue;
    if (!hasPicks(entry.media, filters)) continue;
    leads.push({ entry, otherEntry, isPlannedByOther: false, match: 0, harmony: Math.min(entry.score100, otherEntry.score100) });
  }
  return leads.sort(sorters[filters.sort]);
}

/** Score thresholds offered in the filter, in the viewer's format, with their labels. */
export function scoreThresholds(format: ScoreFormat): { value: number; label: string }[] {
  const { max } = scoreScales[format];
  const steps: Record<number, number[]> = { 100: [50, 60, 70, 80, 90], 10: [5, 6, 7, 8, 9, 10], 5: [2, 3, 4, 5], 3: [2, 3] };
  return [{ value: 0, label: 'Toutes' }, ...(steps[max] ?? []).map((value) => ({ value, label: `≥ ${formatUserScore(value, format)}` }))];
}

/** « Well scored » by default: 70 % of the scale. */
export const defaultMinScore = (format: ScoreFormat) => Math.round(scoreScales[format].max * 0.7);
