import { gql } from '../client';
import { cached, minuteMs } from '../cache';
import type { MediaFormat, MediaSeason, MediaStatus, MediaSummary, MediaType, PageInfo } from '../types';
import { mediaSummaryFields } from './fragments';

export type MediaSort = 'TRENDING_DESC' | 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC' | 'FAVOURITES_DESC' | 'TITLE_ROMAJI' | 'SEARCH_MATCH';

/** A tag the media must have, voted at least `minimumRank` % relevant by AniList users. */
export interface TagFilter {
  name: string;
  minimumRank: number;
}

export interface BrowseFilters {
  type: MediaType;
  search?: string;
  genres?: string[];
  excludedGenres?: string[];
  tags?: TagFilter[];
  excludedTags?: string[];
  year?: number;
  season?: MediaSeason;
  formats?: MediaFormat[];
  status?: MediaStatus;
  /** true keeps only media on the viewer's list, false only media not on it. */
  onList?: boolean;
  sort: MediaSort;
}

export type BrowseMedia = MediaSummary & { genres: string[]; tags?: { name: string; rank: number }[] };

export interface BrowseResult {
  pageInfo: PageInfo;
  media: BrowseMedia[];
}

// <-- Les rangs des tags ne sont demandés que si un tag exige plus que le minimum envoyé à AniList -->
const browseQuery = (withTagRanks: boolean) => `
  query (
    $page: Int, $type: MediaType, $search: String, $genres: [String], $excludedGenres: [String], $tags: [String],
    $excludedTags: [String], $minimumTagRank: Int, $year: Int, $season: MediaSeason, $formats: [MediaFormat],
    $status: MediaStatus, $onList: Boolean, $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: 30) {
      pageInfo { hasNextPage currentPage }
      media(
        type: $type, search: $search, genre_in: $genres, genre_not_in: $excludedGenres, tag_in: $tags,
        tag_not_in: $excludedTags, minimumTagRank: $minimumTagRank, seasonYear: $year, season: $season,
        format_in: $formats, status: $status, onList: $onList, sort: $sort, isAdult: false
      ) { ${mediaSummaryFields} genres ${withTagRanks ? 'tags { name rank }' : ''} }
    }
  }
`;

/** Below this many matches, a page filtered here pulls the next AniList page too. */
const minimumMatchesPerLoad = 12;
const maxPagesPerLoad = 3;

const listOrUndefined = <T>(values: T[] | undefined) => (values?.length ? values : undefined);

const meetsTagRanks = (media: BrowseMedia, tags: TagFilter[]) =>
  tags.every((tag) => (media.tags?.find((mediaTag) => mediaTag.name === tag.name)?.rank ?? 0) >= tag.minimumRank);

function fetchBrowsePage(filters: BrowseFilters, page: number, withTagRanks: boolean): Promise<BrowseResult> {
  const tags = filters.tags ?? [];
  const variables = {
    page,
    type: filters.type,
    search: filters.search || undefined,
    genres: listOrUndefined(filters.genres),
    excludedGenres: listOrUndefined(filters.excludedGenres),
    tags: listOrUndefined(tags.map((tag) => tag.name)),
    excludedTags: listOrUndefined(filters.excludedTags),
    minimumTagRank: tags.length ? Math.min(...tags.map((tag) => tag.minimumRank)) : undefined,
    year: filters.year,
    season: filters.season,
    formats: listOrUndefined(filters.formats),
    status: filters.status,
    onList: filters.onList,
    // <-- AniList refuse le tri SEARCH_MATCH sans texte recherché -->
    sort: [filters.search ? 'SEARCH_MATCH' : filters.sort, 'ID'],
  };
  return cached(`browse:${withTagRanks}:${JSON.stringify(variables)}`, 5 * minuteMs, async () => {
    const { Page } = await gql<{ Page: BrowseResult }>(browseQuery(withTagRanks), variables);
    return Page;
  });
}

/**
 * One page of results. AniList takes a single minimum rank for every tag, so stricter tags are
 * checked here, as is `keep` (the caller's own test); that can consume up to three AniList pages,
 * and `pageInfo` is the last one read.
 */
export async function browseMedia(filters: BrowseFilters, page = 1, keep?: (media: BrowseMedia) => boolean): Promise<BrowseResult> {
  const tags = filters.tags ?? [];
  const lowestRank = Math.min(...tags.map((tag) => tag.minimumRank));
  const hasStricterTag = tags.some((tag) => tag.minimumRank > lowestRank);
  if (!hasStricterTag && !keep) return fetchBrowsePage(filters, page, false);

  const isMatch = (item: BrowseMedia) => (!hasStricterTag || meetsTagRanks(item, tags)) && (!keep || keep(item));
  const media: BrowseMedia[] = [];
  for (let current = page; ; current++) {
    const result = await fetchBrowsePage(filters, current, hasStricterTag);
    media.push(...result.media.filter(isMatch));
    const isEnough = media.length >= minimumMatchesPerLoad || current - page + 1 >= maxPagesPerLoad;
    if (isEnough || !result.pageInfo.hasNextPage) return { pageInfo: result.pageInfo, media };
  }
}

export function fetchGenres(): Promise<string[]> {
  return cached('genres', 60 * minuteMs, async () => {
    const { GenreCollection } = await gql<{ GenreCollection: string[] }>('query { GenreCollection }');
    return GenreCollection;
  });
}

export interface TagGroup {
  category: string;
  names: string[];
}

// <-- Les tags adultes sont écartés : la recherche passe déjà isAdult: false -->
export function fetchTagGroups(): Promise<TagGroup[]> {
  return cached('tags', 60 * minuteMs, async () => {
    const { MediaTagCollection } = await gql<{ MediaTagCollection: { name: string; category: string; isAdult: boolean }[] }>(
      'query { MediaTagCollection { name category isAdult } }',
    );
    const groups = new Map<string, string[]>();
    for (const tag of MediaTagCollection) {
      if (tag.isAdult) continue;
      groups.set(tag.category, [...(groups.get(tag.category) ?? []), tag.name]);
    }
    return [...groups]
      .map(([category, names]) => ({ category, names: names.sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.category.localeCompare(b.category));
  });
}

const seasons: MediaSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

export function currentSeason(date = new Date()): { season: MediaSeason; year: number } {
  return { season: seasons[Math.floor(date.getMonth() / 3)] ?? 'WINTER', year: date.getFullYear() };
}
