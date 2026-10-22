import { gql } from '../client';
import type { MediaTitle, MediaType, PageInfo } from '../types';

interface NotificationMedia {
  id: number;
  type: MediaType;
  title: MediaTitle;
  coverImage: { medium: string };
}

interface NotificationUser {
  name: string;
  avatar: { medium: string };
}

/** AniList's notification union flattened into the few shapes the UI renders. */
export type AppNotification =
  | { kind: 'airing'; id: number; createdAt: number; episode: number; media: NotificationMedia }
  | { kind: 'media'; id: number; createdAt: number; text: string; media: NotificationMedia }
  | { kind: 'user'; id: number; createdAt: number; text: string; user: NotificationUser }
  | { kind: 'other'; id: number; createdAt: number; text: string };

const mediaSelection = 'media { id type title { romaji english native userPreferred } coverImage { medium } }';
const userSelection = 'user { name avatar { medium } }';
const userNotificationTypes = [
  'FollowingNotification',
  'ActivityMessageNotification',
  'ActivityMentionNotification',
  'ActivityReplyNotification',
  'ActivityReplySubscribedNotification',
  'ActivityLikeNotification',
  'ActivityReplyLikeNotification',
  'ThreadCommentMentionNotification',
  'ThreadCommentReplyNotification',
  'ThreadCommentSubscribedNotification',
  'ThreadCommentLikeNotification',
  'ThreadLikeNotification',
];

const notificationsQuery = `
  query ($page: Int) {
    Page(page: $page, perPage: 30) {
      pageInfo { hasNextPage currentPage }
      notifications(resetNotificationCount: true) {
        __typename
        ... on AiringNotification { id createdAt episode ${mediaSelection} }
        ... on RelatedMediaAdditionNotification { id createdAt context ${mediaSelection} }
        ... on MediaDataChangeNotification { id createdAt context ${mediaSelection} }
        ... on MediaMergeNotification { id createdAt context ${mediaSelection} }
        ... on MediaDeletionNotification { id createdAt context deletedMediaTitle }
        ${userNotificationTypes.map((type) => `... on ${type} { id createdAt context ${userSelection} }`).join('\n')}
      }
    }
  }
`;

interface RawNotification {
  __typename: string;
  id: number;
  createdAt: number;
  context?: string;
  episode?: number;
  media?: NotificationMedia;
  user?: NotificationUser;
  deletedMediaTitle?: string;
}

function normalize(raw: RawNotification): AppNotification {
  const base = { id: raw.id, createdAt: raw.createdAt };
  const text = (raw.context ?? '').trim();
  if (raw.__typename === 'AiringNotification' && raw.media && raw.episode) {
    return { ...base, kind: 'airing', episode: raw.episode, media: raw.media };
  }
  if (raw.media) return { ...base, kind: 'media', text, media: raw.media };
  if (raw.user) return { ...base, kind: 'user', text, user: raw.user };
  return { ...base, kind: 'other', text: [raw.deletedMediaTitle, text].filter(Boolean).join(' ') };
}

export async function fetchNotifications(page = 1): Promise<{ pageInfo: PageInfo; notifications: AppNotification[] }> {
  const { Page } = await gql<{ Page: { pageInfo: PageInfo; notifications: (RawNotification | null)[] } }>(notificationsQuery, { page });
  return {
    pageInfo: Page.pageInfo,
    notifications: Page.notifications.filter((raw): raw is RawNotification => raw?.id != null).map(normalize),
  };
}
