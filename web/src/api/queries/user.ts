import { gql } from '../client';
import { cached, invalidate, minuteMs } from '../cache';
import type { MediaListStatus, MediaSummary, MediaType, UserAvatar, Viewer } from '../types';
import { mediaSummaryFields } from './fragments';

const viewerQuery = `
  query {
    Viewer {
      id
      name
      avatar { large medium }
      bannerImage
      unreadNotificationCount
      mediaListOptions { scoreFormat animeList { customLists } mangaList { customLists } }
    }
  }
`;

export async function fetchViewer(): Promise<Viewer> {
  const { Viewer } = await gql<{ Viewer: Viewer }>(viewerQuery);
  return Viewer;
}

export interface GenreCount {
  genre: string;
  count: number;
}

export interface TypeStatistics {
  count: number;
  meanScore: number;
  minutesWatched?: number;
  episodesWatched?: number;
  chaptersRead?: number;
  volumesRead?: number;
  genres: GenreCount[];
  statuses: { status: MediaListStatus; count: number }[];
}

interface FavouriteNode {
  id: number;
  name: { userPreferred: string };
  image: { medium: string };
}

export interface UserProfile {
  id: number;
  name: string;
  /** Raw AniList markdown, rendered by `renderAniListMarkdown`. */
  about: string | null;
  avatar: UserAvatar;
  bannerImage: string | null;
  isFollowing: boolean;
  statistics: { anime: TypeStatistics; manga: TypeStatistics };
  favourites: {
    anime: { nodes: MediaSummary[] };
    manga: { nodes: MediaSummary[] };
    characters: { nodes: FavouriteNode[] };
    staff: { nodes: FavouriteNode[] };
    studios: { nodes: { id: number; name: string }[] };
  };
}

const statisticsFields = `
  count
  meanScore
  genres(limit: 8, sort: COUNT_DESC) { genre count }
  statuses { status count }
`;

const userProfileQuery = `
  query ($name: String) {
    User(name: $name) {
      id
      name
      about
      avatar { large medium }
      bannerImage
      isFollowing
      statistics {
        anime { ${statisticsFields} minutesWatched episodesWatched }
        manga { ${statisticsFields} chaptersRead volumesRead }
      }
      favourites {
        anime(perPage: 25) { nodes { ${mediaSummaryFields} } }
        manga(perPage: 25) { nodes { ${mediaSummaryFields} } }
        characters(perPage: 25) { nodes { id name { userPreferred } image { medium } } }
        staff(perPage: 25) { nodes { id name { userPreferred } image { medium } } }
        studios(perPage: 25) { nodes { id name } }
      }
    }
  }
`;

export function fetchUserProfile(name: string): Promise<UserProfile> {
  return cached(`user:${name}`, 5 * minuteMs, async () => {
    const { User } = await gql<{ User: UserProfile }>(userProfileQuery, { name });
    return User;
  });
}

const viewerAboutQuery = `
  query { Viewer { about } }
`;

// <-- Jamais mis en cache : l'éditeur doit partir du texte réellement enregistré -->
export async function fetchViewerAbout(): Promise<string> {
  const { Viewer } = await gql<{ Viewer: { about: string | null } }>(viewerAboutQuery);
  return Viewer.about ?? '';
}

const saveAboutMutation = `
  mutation ($about: String) { UpdateUser(about: $about) { id } }
`;

export async function saveAbout(name: string, about: string): Promise<void> {
  await gql(saveAboutMutation, { about });
  invalidate(`user:${name}`);
}

const toggleFollowMutation = `
  mutation ($userId: Int) { ToggleFollow(userId: $userId) { isFollowing } }
`;

export async function toggleFollow(userId: number, name: string): Promise<boolean> {
  const { ToggleFollow } = await gql<{ ToggleFollow: { isFollowing: boolean } }>(toggleFollowMutation, { userId });
  invalidate(`user:${name}`);
  invalidate('social:');
  return ToggleFollow.isFollowing;
}

// <-- Une mutation par type : envoyer l'autre type vide effacerait ses listes perso -->
const updateCustomListsMutations: Record<MediaType, string> = {
  ANIME: `
    mutation ($names: [String]) {
      UpdateUser(animeListOptions: { customLists: $names }) { mediaListOptions { animeList { customLists } mangaList { customLists } } }
    }
  `,
  MANGA: `
    mutation ($names: [String]) {
      UpdateUser(mangaListOptions: { customLists: $names }) { mediaListOptions { animeList { customLists } mangaList { customLists } } }
    }
  `,
};

/** Replaces the user's custom list names for one media type; returns AniList's updated list options. */
export async function saveCustomListNames(type: MediaType, names: string[]): Promise<Viewer['mediaListOptions']['animeList']> {
  const { UpdateUser } = await gql<{ UpdateUser: { mediaListOptions: Viewer['mediaListOptions'] } }>(updateCustomListsMutations[type], { names });
  return type === 'ANIME' ? UpdateUser.mediaListOptions.animeList : UpdateUser.mediaListOptions.mangaList;
}

/** One row of a statistics breakdown: how many entries, and their mean score (100-point scale, 0 when unscored). */
interface StatCount {
  count: number;
  meanScore: number;
}

export interface DetailedStatistics {
  count: number;
  meanScore: number;
  standardDeviation: number;
  minutesWatched?: number;
  episodesWatched?: number;
  chaptersRead?: number;
  volumesRead?: number;
  formats: { format: string; count: number }[];
  statuses: { status: MediaListStatus; count: number }[];
  scores: { score: number; count: number }[];
  releaseYears: { releaseYear: number; count: number }[];
  countries: { country: string; count: number }[];
  genres: (StatCount & { genre: string })[];
  tags: (StatCount & { tag: { id: number; name: string } })[];
  studios?: (StatCount & { studio: { id: number; name: string } })[];
  voiceActors?: (StatCount & { voiceActor: { id: number; name: { userPreferred: string } } })[];
  staff: (StatCount & { staff: { id: number; name: { userPreferred: string } } })[];
}

const detailedStatisticsFields = `
  count
  meanScore
  standardDeviation
  formats(sort: COUNT_DESC) { format count }
  statuses(sort: COUNT_DESC) { status count }
  scores(sort: MEAN_SCORE) { score count }
  releaseYears(sort: ID) { releaseYear count }
  countries(sort: COUNT_DESC) { country count }
  genres(limit: 12, sort: COUNT_DESC) { genre count meanScore }
  tags(limit: 12, sort: COUNT_DESC) { tag { id name } count meanScore }
  staff(limit: 10, sort: COUNT_DESC) { staff { id name { userPreferred } } count meanScore }
`;

const userStatisticsQuery = `
  query ($name: String) {
    User(name: $name) {
      statistics {
        anime {
          ${detailedStatisticsFields}
          minutesWatched
          episodesWatched
          studios(limit: 10, sort: COUNT_DESC) { studio { id name } count meanScore }
          voiceActors(limit: 10, sort: COUNT_DESC) { voiceActor { id name { userPreferred } } count meanScore }
        }
        manga { ${detailedStatisticsFields} chaptersRead volumesRead }
      }
    }
  }
`;

/** A user's full statistics for both media types (the stats tab). */
export function fetchUserStatistics(name: string): Promise<Record<MediaType, DetailedStatistics>> {
  return cached(`user:stats:${name}`, 10 * minuteMs, async () => {
    const { User } = await gql<{ User: { statistics: { anime: DetailedStatistics; manga: DetailedStatistics } } }>(userStatisticsQuery, { name });
    return { ANIME: User.statistics.anime, MANGA: User.statistics.manga };
  });
}
