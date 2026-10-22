import { gql } from '../client';
import { cached, minuteMs } from '../cache';
import type { MediaFormat, MediaSeason, MediaStatus, MediaSummary, MediaType, PageInfo } from '../types';
import { mediaSummaryFields } from './fragments';

export type MediaSort = 'TRENDING_DESC' | 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC' | 'FAVOURITES_DESC' | 'TITLE_ROMAJI' | 'SEARCH_MATCH';

export interface BrowseFilters {
  type: MediaType;
  search?: string;
  genres?: string[];
  tags?: string[];
  year?: number;
  season?: MediaSeason;
  formats?: MediaFormat[];
  status?: MediaStatus;
  sort: MediaSort;
}

export interface BrowseResult {
  pageInfo: PageInfo;
  media: (MediaSummary & { genres: string[] })[];
}

const browseQuery = `
  query (
    $page: Int, $type: MediaType, $search: String, $genres: [String], $tags: [String], $year: Int,
    $season: MediaSeason, $formats: [MediaFormat], $status: MediaStatus, $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: 30) {
      pageInfo { hasNextPage currentPage }
      media(
        type: $type, search: $search, genre_in: $genres, tag_in: $tags, seasonYear: $year, season: $season,
        format_in: $formats, status: $status, sort: $sort, isAdult: false
      ) { ${mediaSummaryFields} genres }
    }
  }
`;

export function browseMedia(filters: BrowseFilters, page = 1): Promise<BrowseResult> {
  const variables = {
    page,
    type: filters.type,
    search: filters.search || undefined,
    genres: filters.genres?.length ? filters.genres : undefined,
    tags: filters.tags?.length ? filters.tags : undefined,
    year: filters.year,
    season: filters.season,
    formats: filters.formats?.length ? filters.formats : undefined,
    status: filters.status,
    // <-- AniList refuse le tri SEARCH_MATCH sans texte recherché -->
    sort: [filters.search ? 'SEARCH_MATCH' : filters.sort, 'ID'],
  };
  return cached(`browse:${JSON.stringify(variables)}`, 5 * minuteMs, async () => {
    const { Page } = await gql<{ Page: BrowseResult }>(browseQuery, variables);
    return Page;
  });
}

export function fetchGenres(): Promise<string[]> {
  return cached('genres', 60 * minuteMs, async () => {
    const { GenreCollection } = await gql<{ GenreCollection: string[] }>('query { GenreCollection }');
    return GenreCollection;
  });
}

const seasons: MediaSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

export function currentSeason(date = new Date()): { season: MediaSeason; year: number } {
  return { season: seasons[Math.floor(date.getMonth() / 3)] ?? 'WINTER', year: date.getFullYear() };
}
