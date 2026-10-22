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
      about(asHtml: true)
      avatar { large medium }
      bannerImage
      isFollowing
      statistics {
        anime { ${statisticsFields} minutesWatched episodesWatched }
        manga { ${statisticsFields} chaptersRead volumesRead }
      }
      favourites {
        anime(perPage: 12) { nodes { ${mediaSummaryFields} } }
        manga(perPage: 12) { nodes { ${mediaSummaryFields} } }
        characters(perPage: 12) { nodes { id name { userPreferred } image { medium } } }
        staff(perPage: 12) { nodes { id name { userPreferred } image { medium } } }
        studios(perPage: 12) { nodes { id name } }
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
