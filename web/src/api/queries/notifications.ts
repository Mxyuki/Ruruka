import { excerptHtml } from '../../lib/html';
import { activityPath, mediaPath } from '../../lib/routes';
import { cached, minuteMs } from '../cache';
import { gql } from '../client';
import type { MediaTitle, MediaType, PageInfo } from '../types';

interface NotificationMedia {
  id: number;
  type: MediaType;
  title: MediaTitle;
  coverImage: { medium: string };
}

interface NotificationUser {
  id: number;
  name: string;
  avatar: { medium: string };
}

/** What a notification is about: a page of the app, or anilist.co for the forum, which the app doesn't have. */
export type NotificationTarget = { label: string } & ({ path: string } | { siteUrl: string });

/** AniList's notification union flattened into the few shapes the UI renders. */
export type AppNotification =
  | { kind: 'airing'; id: number; createdAt: number; episode: number; media: NotificationMedia }
  | { kind: 'media'; id: number; createdAt: number; text: string; media: NotificationMedia }
  | { kind: 'user'; id: number; createdAt: number; text: string; user: NotificationUser; target: NotificationTarget | null }
  | { kind: 'other'; id: number; createdAt: number; text: string };

const mediaSelection = 'media { id type title { romaji english native userPreferred } coverImage { medium } }';
const userSelection = 'user { id name avatar { medium } }';
const forumSelection = 'thread { title siteUrl } comment { comment(asHtml: true) siteUrl }';

const notificationDetails: [type: string, details: string][] = [
  ['FollowingNotification', ''],
  ['ActivityMessageNotification', 'message { id message(asHtml: true) }'],
  ['ActivityMentionNotification', 'activityId'],
  ['ActivityReplyNotification', 'activityId'],
  ['ActivityReplySubscribedNotification', 'activityId'],
  ['ActivityLikeNotification', 'activityId'],
  ['ActivityReplyLikeNotification', 'activityId'],
  ['ThreadCommentMentionNotification', forumSelection],
  ['ThreadCommentReplyNotification', forumSelection],
  ['ThreadCommentSubscribedNotification', forumSelection],
  ['ThreadCommentLikeNotification', forumSelection],
  ['ThreadLikeNotification', 'thread { title siteUrl }'],
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
        ${notificationDetails.map(([type, details]) => `... on ${type} { id createdAt context ${userSelection} ${details} }`).join('\n')}
      }
    }
  }
`;

interface RawReply {
  id: number;
  userId: number;
  text: string;
  likes: { id: number }[];
}

interface RawActivity {
  id: number;
  media?: { id: number; title: { userPreferred: string } };
  text?: string;
  message?: string;
  replies?: RawReply[];
}

interface RawNotification {
  __typename: string;
  id: number;
  createdAt: number;
  context?: string;
  episode?: number;
  media?: NotificationMedia;
  user?: NotificationUser;
  deletedMediaTitle?: string;
  activityId?: number;
  message?: RawActivity | null;
  thread?: { title: string; siteUrl: string } | null;
  comment?: { comment: string; siteUrl: string } | null;
}

// <-- Le champ `activity` d'une notification peut arriver sans son média : on relit les activités par identifiant.
// AniList ne dit pas non plus quelle réponse a été aimée : on la retrouve parmi celles de l'activité -->
const notifiedActivitiesQuery = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      activities(id_in: $ids) {
        ... on ListActivity { id media { id title { userPreferred } } replies { id userId text(asHtml: true) likes { id } } }
        ... on TextActivity { id text(asHtml: true) replies { id userId text(asHtml: true) likes { id } } }
      }
    }
  }
`;

async function fetchNotifiedActivities(notifications: RawNotification[]): Promise<Map<number, RawActivity>> {
  const ids = [...new Set(notifications.flatMap((raw) => raw.activityId ?? []))];
  if (!ids.length) return new Map();
  const { Page } = await gql<{ Page: { activities: (RawActivity | null)[] } }>(notifiedActivitiesQuery, { ids });
  return new Map(Page.activities.flatMap((activity) => (activity?.id ? [[activity.id, activity]] : [])));
}

const excerptLength = 80;
const quote = (html: string | undefined) => `« ${excerptHtml(html, excerptLength) || '…'} »`;

function activityTarget(raw: RawNotification, activities: Map<number, RawActivity>, viewerId: number): NotificationTarget | null {
  const activity = raw.message ?? activities.get(raw.activityId ?? 0);
  if (!activity) return null;

  if (raw.__typename === 'ActivityReplyLikeNotification') {
    const reply = activity.replies?.findLast((candidate) => candidate.userId === viewerId && candidate.likes.some((like) => like.id === raw.user?.id));
    return { label: quote(reply?.text), path: activityPath(activity.id, reply?.id) };
  }
  if (!activity.media) return { label: quote(activity.text ?? activity.message), path: activityPath(activity.id) };

  // <-- Aimer une ligne de liste vise l'œuvre ; y répondre vise la conversation -->
  const isLike = raw.__typename === 'ActivityLikeNotification';
  return { label: `« ${activity.media.title.userPreferred} »`, path: isLike ? mediaPath(activity.media.id) : activityPath(activity.id) };
}

function forumTarget(raw: RawNotification): NotificationTarget | null {
  if (!raw.thread) return null;
  if (raw.comment && raw.__typename === 'ThreadCommentLikeNotification') return { label: quote(raw.comment.comment), siteUrl: raw.comment.siteUrl };
  return { label: quote(raw.thread.title), siteUrl: raw.comment?.siteUrl ?? raw.thread.siteUrl };
}

function normalize(raw: RawNotification, activities: Map<number, RawActivity>, viewerId: number): AppNotification {
  const base = { id: raw.id, createdAt: raw.createdAt };
  const text = (raw.context ?? '').trim();
  if (raw.__typename === 'AiringNotification' && raw.media && raw.episode) {
    return { ...base, kind: 'airing', episode: raw.episode, media: raw.media };
  }
  if (raw.media) return { ...base, kind: 'media', text, media: raw.media };
  if (raw.user) return { ...base, kind: 'user', text, user: raw.user, target: activityTarget(raw, activities, viewerId) ?? forumTarget(raw) };
  return { ...base, kind: 'other', text: [raw.deletedMediaTitle, text].filter(Boolean).join(' ') };
}

export async function fetchNotifications(viewerId: number, page = 1): Promise<{ pageInfo: PageInfo; notifications: AppNotification[] }> {
  const { Page } = await gql<{ Page: { pageInfo: PageInfo; notifications: (RawNotification | null)[] } }>(notificationsQuery, { page });
  const notifications = Page.notifications.filter((raw): raw is RawNotification => raw?.id != null);
  const activities = await fetchNotifiedActivities(notifications);
  return { pageInfo: Page.pageInfo, notifications: notifications.map((raw) => normalize(raw, activities, viewerId)) };
}

export interface RecentAiring {
  mediaId: number;
  episode: number;
  /** Unix seconds, when AniList sent the notification (the episode's airing time). */
  createdAt: number;
}

// <-- resetNotificationCount: false explicite : l'accueil ne doit pas marquer les notifications comme lues -->
const recentAiringQuery = `
  query {
    Page(perPage: 15) {
      notifications(type_in: [AIRING], resetNotificationCount: false) {
        ... on AiringNotification { createdAt episode media { id } }
      }
    }
  }
`;

/** Episodes announced by an airing notification since `sinceSeconds` (Unix seconds), newest first. */
export async function fetchRecentAirings(sinceSeconds: number): Promise<RecentAiring[]> {
  const airings = await cached('notifications:airing', 5 * minuteMs, async () => {
    const { Page } = await gql<{ Page: { notifications: ({ createdAt?: number; episode?: number; media?: { id: number } } | null)[] } }>(recentAiringQuery);
    return Page.notifications.flatMap((raw) =>
      raw?.media && raw.episode && raw.createdAt ? [{ mediaId: raw.media.id, episode: raw.episode, createdAt: raw.createdAt }] : [],
    );
  });
  return airings.filter((airing) => airing.createdAt >= sinceSeconds).sort((a, b) => b.createdAt - a.createdAt);
}
