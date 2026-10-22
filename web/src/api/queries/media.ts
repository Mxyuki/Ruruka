import { gql, gqlBackground } from '../client';
import { cached, invalidate, minuteMs } from '../cache';
import type { FuzzyDate, MediaListStatus, MediaSummary, MediaType, NamedNode } from '../types';
import { mediaSummaryFields } from './fragments';

export interface Ranking {
  rank: number;
  type: 'RATED' | 'POPULAR';
  allTime: boolean;
  season: string | null;
  year: number | null;
  format: string;
  context: string;
}

export interface MediaTag {
  name: string;
  rank: number;
  category: string | null;
  isMediaSpoiler: boolean;
  isGeneralSpoiler: boolean;
}

export interface CharacterEdge {
  role: string;
  node: NamedNode;
  voiceActors: NamedNode[];
}

export interface StaffEdge {
  role: string;
  node: NamedNode;
}

export interface RelationEdge {
  relationType: string;
  node: MediaSummary;
}

export interface StudioNode {
  id: number;
  name: string;
}

export interface ExternalLink {
  site: string;
  url: string;
  type: string | null;
  icon: string | null;
  color: string | null;
}

export interface MediaDetails extends MediaSummary {
  description: string | null;
  coverImage: MediaSummary['coverImage'] & { extraLarge: string };
  duration: number | null;
  volumes: number | null;
  source: string | null;
  genres: string[];
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  isFavourite: boolean;
  hashtag: string | null;
  countryOfOrigin: string | null;
  startDate: FuzzyDate;
  endDate: FuzzyDate;
  studios: StudioNode[];
  producers: StudioNode[];
  rankings: Ranking[];
  tags: MediaTag[];
  trailer: { id: string; site: string; thumbnail: string } | null;
  externalLinks: ExternalLink[];
  stats: {
    scoreDistribution: { score: number; amount: number }[];
    statusDistribution: { status: MediaListStatus; amount: number }[];
  };
  characters: CharacterEdge[];
  staff: StaffEdge[];
  relations: RelationEdge[];
  recommendations: MediaSummary[];
}

const mediaQuery = `
  query ($id: Int) {
    Media(id: $id) {
      ${mediaSummaryFields}
      description(asHtml: true)
      coverImage { extraLarge large medium color }
      duration
      volumes
      source
      genres
      meanScore
      popularity
      favourites
      isFavourite
      hashtag
      countryOfOrigin
      startDate { year month day }
      endDate { year month day }
      studios { edges { isMain node { id name } } }
      rankings { rank type allTime season year format context }
      tags { name rank category isMediaSpoiler isGeneralSpoiler }
      trailer { id site thumbnail }
      externalLinks { site url type icon color }
      stats {
        scoreDistribution { score amount }
        statusDistribution { status amount }
      }
      characters(sort: [ROLE, RELEVANCE, ID], perPage: 24) {
        edges {
          role
          node { id name { userPreferred } image { medium } }
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { userPreferred } image { medium } }
        }
      }
      staff(sort: [RELEVANCE, ID], perPage: 12) {
        edges { role node { id name { userPreferred } image { medium } } }
      }
      relations {
        edges { relationType(version: 2) node { ${mediaSummaryFields} } }
      }
      recommendations(sort: [RATING_DESC, ID], perPage: 12) {
        nodes { mediaRecommendation { ${mediaSummaryFields} } }
      }
    }
  }
`;

interface RawMedia extends Omit<MediaDetails, 'studios' | 'producers' | 'characters' | 'staff' | 'relations' | 'recommendations'> {
  studios: { edges: { isMain: boolean; node: StudioNode }[] };
  characters: { edges: CharacterEdge[] };
  staff: { edges: StaffEdge[] };
  relations: { edges: RelationEdge[] };
  recommendations: { nodes: { mediaRecommendation: MediaSummary | null }[] };
}

// <-- AniList ne sait pas filtrer studios et producteurs dans une même requête : on les sépare ici -->
export function fetchMedia(id: number): Promise<MediaDetails> {
  return cached(`media:${id}`, 10 * minuteMs, async () => {
    const { Media } = await gql<{ Media: RawMedia }>(mediaQuery, { id });
    const studiosWhere = (isMain: boolean) => Media.studios.edges.filter((edge) => edge.isMain === isMain).map((edge) => edge.node);
    return {
      ...Media,
      studios: studiosWhere(true),
      producers: studiosWhere(false),
      characters: Media.characters.edges,
      staff: Media.staff.edges,
      relations: Media.relations.edges,
      recommendations: Media.recommendations.nodes.flatMap((node) => (node.mediaRecommendation ? [node.mediaRecommendation] : [])),
    };
  });
}

export interface FollowingEntry {
  name: string;
  avatar: string;
  status: MediaListStatus;
  progress: number;
  score: number;
}

const followingQuery = `
  query ($mediaId: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      mediaList(mediaId: $mediaId, isFollowing: true, sort: UPDATED_TIME_DESC) {
        status
        progress
        score(format: POINT_100)
        user { name avatar { medium } }
      }
    }
  }
`;

const maxFollowingPages = 4;

/** Followed users' entries for a media, scores normalized to 0–100. */
export function fetchFollowing(mediaId: number): Promise<FollowingEntry[]> {
  return cached(`following:${mediaId}`, 10 * minuteMs, async () => {
    // <-- Clé par pseudo : une personne mise à jour pendant le chargement peut glisser d'une page à l'autre -->
    const following = new Map<string, FollowingEntry>();
    for (let page = 1; page <= maxFollowingPages; page++) {
      const { Page } = await gql<{
        Page: {
          pageInfo: { hasNextPage: boolean };
          mediaList: { status: MediaListStatus; progress: number; score: number; user: { name: string; avatar: { medium: string } } }[];
        };
      }>(followingQuery, { mediaId, page });
      for (const { status, progress, score, user } of Page.mediaList) {
        following.set(user.name, { name: user.name, avatar: user.avatar.medium, status, progress, score });
      }
      if (!Page.pageInfo.hasNextPage) break;
    }
    return [...following.values()];
  });
}

const toggleFavouriteMutation = `
  mutation ($animeId: Int, $mangaId: Int) { ToggleFavourite(animeId: $animeId, mangaId: $mangaId) { anime { pageInfo { total } } } }
`;

export async function toggleMediaFavourite(id: number, type: MediaType): Promise<void> {
  await gql(toggleFavouriteMutation, type === 'ANIME' ? { animeId: id } : { mangaId: id });
  invalidate(`media:${id}`);
}

const summariesQuery = `
  query ($ids: [Int]) {
    Page(perPage: 50) { media(id_in: $ids) { ${mediaSummaryFields} } }
  }
`;

export async function fetchMediaSummaries(ids: number[]): Promise<MediaSummary[]> {
  if (!ids.length) return [];
  const { Page } = await gql<{ Page: { media: MediaSummary[] } }>(summariesQuery, { ids: ids.slice(0, 50) });
  return Page.media;
}

const titleSearchQuery = `
  query ($search: String, $type: MediaType) {
    Page(perPage: 8) { media(search: $search, type: $type) { ${mediaSummaryFields} } }
  }
`;

/** Throttled title search for background matching. */
export async function searchMediaByTitle(search: string, type: MediaType = 'ANIME'): Promise<MediaSummary[]> {
  const { Page } = await gqlBackground<{ Page: { media: MediaSummary[] } }>(titleSearchQuery, { search, type });
  return Page.media;
}

/** Immediate title search for interactive pickers. */
export async function quickSearchMedia(search: string, type: MediaType = 'ANIME'): Promise<MediaSummary[]> {
  const { Page } = await gql<{ Page: { media: MediaSummary[] } }>(titleSearchQuery, { search, type });
  return Page.media;
}
