import type { MediaSort } from '../../api/queries/search';
import { listStatuses, type MediaFormat, type MediaSeason, type MediaStatus } from '../../api/types';
import { defaultTagRank, type FilterPick, type ListChoice } from './filterPicks';

/** Everything Explorer keeps in its address, so going back to it restores the same search. */
export interface SearchState {
  search: string;
  genrePicks: FilterPick[];
  tagPicks: FilterPick[];
  year: string;
  season?: MediaSeason;
  format?: MediaFormat;
  status?: MediaStatus;
  sort: MediaSort;
  listChoices: ListChoice[];
  /** The last AniList page shown, so "Voir plus" results come back too. */
  page: number;
}

export const defaultSort: MediaSort = 'POPULARITY_DESC';

const listChoiceValues: ListChoice[] = [...listStatuses, 'NONE'];
const excludedPrefix = '-';
const rankSuffix = /^(.+):(\d{1,3})$/;

// <-- Un filtre s'écrit « Nom », « -Nom » s'il est exclu, et « Nom:60 » pour un mot-clé à 60 % -->
function readPick(value: string, isTag: boolean): FilterPick {
  const isExcluded = value.startsWith(excludedPrefix);
  const body = isExcluded ? value.slice(excludedPrefix.length) : value;
  const ranked = isTag ? body.match(rankSuffix) : null;
  const name = ranked?.[1] ?? body;
  const minimumRank = isTag ? Number(ranked?.[2] ?? defaultTagRank) : undefined;
  return { name, isExcluded, minimumRank };
}

function writePick(pick: FilterPick): string {
  if (pick.isExcluded) return `${excludedPrefix}${pick.name}`;
  return pick.minimumRank !== undefined && pick.minimumRank !== defaultTagRank ? `${pick.name}:${pick.minimumRank}` : pick.name;
}

export function readSearchState(query: URLSearchParams): SearchState {
  const optional = <T extends string>(key: string) => (query.get(key) as T | null) ?? undefined;
  return {
    search: query.get('q') ?? '',
    genrePicks: query.getAll('genre').map((value) => readPick(value, false)),
    tagPicks: query.getAll('tag').map((value) => readPick(value, true)),
    year: query.get('year') ?? '',
    season: optional('season'),
    format: optional('format'),
    status: optional('status'),
    sort: optional<MediaSort>('sort') ?? defaultSort,
    page: Math.max(1, Number(query.get('page')) || 1),
    listChoices: (query.get('list')?.split(',') ?? []).filter((value): value is ListChoice => listChoiceValues.includes(value as ListChoice)),
  };
}

export function writeSearchState(state: SearchState): URLSearchParams {
  const query = new URLSearchParams();
  if (state.search) query.set('q', state.search);
  for (const pick of state.genrePicks) query.append('genre', writePick(pick));
  for (const pick of state.tagPicks) query.append('tag', writePick(pick));
  if (state.year) query.set('year', state.year);
  if (state.season) query.set('season', state.season);
  if (state.format) query.set('format', state.format);
  if (state.status) query.set('status', state.status);
  if (state.sort !== defaultSort) query.set('sort', state.sort);
  if (state.listChoices.length) query.set('list', state.listChoices.join(','));
  if (state.page > 1) query.set('page', String(state.page));
  return query;
}
