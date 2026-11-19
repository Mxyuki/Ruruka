import type { ListTraits } from '../../api/queries/list';
import type { BrowseFilters, BrowseMedia } from '../../api/queries/search';
import type { ListEntry, MediaListStatus } from '../../api/types';
import { normalizeForMatch } from '../../lib/titleMatch';

const emptyTraits: ListTraits = { genres: [], tags: [], popularity: null, favourites: null, trending: null, startDate: { year: null, month: null, day: null } };

const startKey = ({ year, month, day }: ListTraits['startDate']) => (year ?? 0) * 10_000 + (month ?? 0) * 100 + (day ?? 0);

function titlesOf(media: ListEntry['media']): string[] {
  return [media.title.romaji, media.title.english, media.title.native, media.title.userPreferred, ...media.synonyms]
    .filter((title): title is string => Boolean(title))
    .map(normalizeForMatch);
}

function matches(media: BrowseMedia, traits: ListTraits, filters: BrowseFilters): boolean {
  const { search, genres, excludedGenres, tags, excludedTags, year, season, formats, status } = filters;
  if (genres?.some((genre) => !traits.genres.includes(genre))) return false;
  if (excludedGenres?.some((genre) => traits.genres.includes(genre))) return false;
  if (tags?.some((tag) => (traits.tags.find((mediaTag) => mediaTag.name === tag.name)?.rank ?? 0) < tag.minimumRank)) return false;
  if (excludedTags?.some((name) => traits.tags.some((mediaTag) => mediaTag.name === name))) return false;
  if (year && media.seasonYear !== year) return false;
  if (season && media.season !== season) return false;
  if (formats?.length && !formats.some((format) => format === media.format)) return false;
  if (status && media.status !== status) return false;
  if (search) {
    const wanted = normalizeForMatch(search);
    if (!titlesOf(media).some((title) => title.includes(wanted))) return false;
  }
  return true;
}

const sortValue: Record<Exclude<BrowseFilters['sort'], 'SEARCH_MATCH'>, (media: BrowseMedia, traits: ListTraits) => number | string> = {
  TRENDING_DESC: (_, traits) => -(traits.trending ?? 0),
  POPULARITY_DESC: (_, traits) => -(traits.popularity ?? 0),
  SCORE_DESC: (media) => -(media.averageScore ?? 0),
  FAVOURITES_DESC: (_, traits) => -(traits.favourites ?? 0),
  START_DATE_DESC: (_, traits) => -startKey(traits.startDate),
  TITLE_ROMAJI: (media) => (media.title.romaji ?? media.title.userPreferred).toLowerCase(),
};

/**
 * The viewer's own entries in one of `statuses`, filtered and sorted like Explorer would: the list
 * and its traits are already loaded, so no AniList page is read.
 */
export function browseOwnList(
  entries: ListEntry[],
  traitsByMedia: Map<number, ListTraits>,
  statuses: MediaListStatus[],
  filters: BrowseFilters,
): BrowseMedia[] {
  const sortKey = sortValue[filters.sort === 'SEARCH_MATCH' ? 'TRENDING_DESC' : filters.sort];
  return entries
    .filter((entry) => statuses.includes(entry.status))
    .map((entry) => {
      const traits = traitsByMedia.get(entry.mediaId) ?? emptyTraits;
      return { media: { ...entry.media, genres: traits.genres, tags: traits.tags }, traits };
    })
    .filter(({ media, traits }) => matches(media, traits, filters))
    .map((item) => ({ ...item, key: sortKey(item.media, item.traits) }))
    .sort((a, b) => (typeof a.key === 'string' ? a.key.localeCompare(String(b.key)) : (a.key as number) - (b.key as number)))
    .map(({ media }) => media);
}
