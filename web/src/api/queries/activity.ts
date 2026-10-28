import { gql } from '../client';
import type { MediaTitle, MediaType, PageInfo } from '../types';

export interface ActivityUser {
  id: number;
  name: string;
  avatar: { medium: string };
}

interface Social {
  likeCount: number;
  isLiked: boolean;
}

export type Activity = Social & { replyCount: number } & (
  | {
      kind: 'list';
      id: number;
      createdAt: number;
      user: ActivityUser;
      /** AniList's own phrasing, e.g. "watched episode", "completed", "plans to watch". */
      status: string;
      /** A single number or a range such as "4 - 6"; null when the status has no progress. */
      progress: string | null;
      media: { id: number; type: MediaType; title: MediaTitle; coverImage: { medium: string; large: string } };
    }
  | { kind: 'text'; id: number; createdAt: number; user: ActivityUser; text: string }
);

export interface ActivityReply extends Social {
  id: number;
  createdAt: number;
  text: string;
  user: ActivityUser;
}

export interface ActivityPage {
  pageInfo: PageInfo;
  activities: Activity[];
}

const userSelection = 'user { id name avatar { medium } }';
const socialFields = 'likeCount isLiked replyCount';
const replyFields = `id createdAt text(asHtml: true) likeCount isLiked ${userSelection}`;

/** `filter` is spliced into `activities(…)`, e.g. "isFollowing: true" or "userId: $userId". */
const activityQuery = (variables: string, filter: string) => `
  query ($page: Int${variables}) {
    Page(page: $page, perPage: 20) {
      pageInfo { hasNextPage currentPage }
      activities(${filter}, type_in: [ANIME_LIST, MANGA_LIST, TEXT], sort: ID_DESC) {
        __typename
        ... on ListActivity {
          id createdAt status progress ${socialFields} ${userSelection}
          media { id type title { romaji english native userPreferred } coverImage { medium large } }
        }
        ... on TextActivity { id createdAt text(asHtml: true) ${socialFields} ${userSelection} }
      }
    }
  }
`;

const followingActivityQuery = activityQuery('', 'isFollowing: true');
const userActivityQuery = activityQuery(', $userId: Int', 'userId: $userId');

type ListFields = Omit<Extract<Activity, { kind: 'list' }>, 'kind'>;
type TextFields = Omit<Extract<Activity, { kind: 'text' }>, 'kind'>;
type RawActivity = ({ __typename: 'ListActivity' } & ListFields) | ({ __typename: 'TextActivity' } & TextFields);

function normalize(raw: RawActivity): Activity {
  if (raw.__typename === 'ListActivity') {
    const { __typename, ...activity } = raw;
    return { kind: 'list', ...activity };
  }
  const { __typename, ...activity } = raw;
  return { kind: 'text', ...activity };
}

async function fetchActivities(query: string, variables: Record<string, unknown>, keep: (raw: RawActivity) => boolean): Promise<ActivityPage> {
  const { Page } = await gql<{ Page: { pageInfo: PageInfo; activities: (RawActivity | null)[] } }>(query, variables);
  const activities = Page.activities.filter((raw): raw is RawActivity => raw?.id != null && keep(raw)).map(normalize);
  return { pageInfo: Page.pageInfo, activities };
}

/** Activity from followed users, newest first. AniList's following feed includes the viewer, so they are filtered out. */
export function fetchFriendActivity(viewerId: number, page = 1): Promise<ActivityPage> {
  return fetchActivities(followingActivityQuery, { page }, (raw) => raw.user.id !== viewerId);
}

export function fetchUserActivity(userId: number, page = 1): Promise<ActivityPage> {
  return fetchActivities(userActivityQuery, { page, userId }, () => true);
}

const repliesQuery = `
  query ($activityId: Int) {
    Page(perPage: 50) { activityReplies(activityId: $activityId) { ${replyFields} } }
  }
`;

export async function fetchReplies(activityId: number): Promise<ActivityReply[]> {
  const { Page } = await gql<{ Page: { activityReplies: ActivityReply[] } }>(repliesQuery, { activityId });
  return Page.activityReplies;
}

const saveReplyMutation = `
  mutation ($activityId: Int, $text: String) { SaveActivityReply(activityId: $activityId, text: $text) { ${replyFields} } }
`;

export async function postReply(activityId: number, text: string): Promise<ActivityReply> {
  const { SaveActivityReply } = await gql<{ SaveActivityReply: ActivityReply }>(saveReplyMutation, { activityId, text });
  return SaveActivityReply;
}

const saveTextActivityMutation = `
  mutation ($text: String) { SaveTextActivity(text: $text) { id createdAt text(asHtml: true) ${socialFields} ${userSelection} } }
`;

export async function postStatus(text: string): Promise<Activity> {
  const { SaveTextActivity } = await gql<{ SaveTextActivity: TextFields }>(saveTextActivityMutation, { text });
  return { kind: 'text', ...SaveTextActivity };
}

export type LikeTarget = 'ACTIVITY' | 'ACTIVITY_REPLY';

const toggleLikeMutation = `
  mutation ($id: Int, $type: LikeableType) {
    ToggleLikeV2(id: $id, type: $type) {
      ... on ListActivity { likeCount isLiked }
      ... on TextActivity { likeCount isLiked }
      ... on ActivityReply { likeCount isLiked }
    }
  }
`;

/** Likes or unlikes, returning AniList's resulting state. */
export async function toggleLike(id: number, type: LikeTarget): Promise<Social> {
  const { ToggleLikeV2 } = await gql<{ ToggleLikeV2: Social }>(toggleLikeMutation, { id, type });
  return ToggleLikeV2;
}
