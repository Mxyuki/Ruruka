export type MediaType = 'ANIME' | 'MANGA';
export type MediaFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC' | 'MANGA' | 'NOVEL' | 'ONE_SHOT';
export type MediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
export type MediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
export type MediaListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';
export type ScoreFormat = 'POINT_100' | 'POINT_10_DECIMAL' | 'POINT_10' | 'POINT_5' | 'POINT_3';

export const listStatuses: MediaListStatus[] = ['CURRENT', 'REPEATING', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'];

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface MediaTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred: string;
}

export interface CoverImage {
  medium: string;
  large: string;
  extraLarge?: string;
  color: string | null;
}

export interface AiringEpisode {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
}

/** The fields every media card needs; queries spread `mediaSummaryFields` to get them. */
export interface MediaSummary {
  id: number;
  type: MediaType;
  format: MediaFormat | null;
  status: MediaStatus | null;
  title: MediaTitle;
  synonyms: string[];
  coverImage: CoverImage;
  bannerImage: string | null;
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null;
  season: MediaSeason | null;
  seasonYear: number | null;
  nextAiringEpisode: AiringEpisode | null;
}

export interface ListEntry {
  id: number;
  mediaId: number;
  status: MediaListStatus;
  progress: number;
  progressVolumes: number | null;
  score: number;
  repeat: number;
  private: boolean;
  notes: string | null;
  startedAt: FuzzyDate;
  completedAt: FuzzyDate;
  updatedAt: number;
  /** Every custom list of this media type, with whether this entry is in it; null when the user has none. */
  customLists: CustomListFlag[] | null;
  hiddenFromStatusLists: boolean;
  media: MediaSummary;
}

/** Another user's list entry: only what their read-only list shows. */
export type PublicListEntry = Pick<ListEntry, 'id' | 'mediaId' | 'status' | 'progress' | 'score' | 'updatedAt' | 'customLists' | 'media'>;

export interface CustomListFlag {
  name: string;
  enabled: boolean;
}

export type ListEntryChanges = Partial<Pick<ListEntry,
  'status' | 'progress' | 'progressVolumes' | 'score' | 'repeat' | 'private' | 'notes' | 'startedAt' | 'completedAt' | 'hiddenFromStatusLists'>> & {
  /** Names of the custom lists the entry should be in; lists left out are removed. */
  customLists?: string[];
};

export interface UserAvatar {
  large: string;
  medium: string;
}

export interface Viewer {
  id: number;
  name: string;
  avatar: UserAvatar;
  bannerImage: string | null;
  unreadNotificationCount: number;
  mediaListOptions: {
    scoreFormat: ScoreFormat;
    animeList: { customLists: string[] };
    mangaList: { customLists: string[] };
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  currentPage: number;
}

export interface NamedNode {
  id: number;
  name: { userPreferred: string };
  image: { medium: string; large?: string };
}
