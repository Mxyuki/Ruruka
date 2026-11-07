import { gql } from '../client';
import type { MediaTitle, MediaType, PageInfo, ScoreFormat } from '../types';

export interface ActivityUser {
  id: number;
  name: string;
  avatar: { medium: string };
}

interface Social {
  likeCount: number;
  isLiked: boolean;
  likes: ActivityUser[];
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
      /** For a completed or dropped media: the user's current score, in the viewer's format; null when unscored. */
      score: number | null;
    }
  | { kind: 'text'; id: number; createdAt: number; user: ActivityUser; text: string }
  | { kind: 'message'; id: number; createdAt: number; user: ActivityUser; text: string }
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
const likeFields = `likeCount isLiked likes { id name avatar { medium } }`;
const socialFields = `${likeFields} replyCount`;
const replyFields = `id createdAt text(asHtml: true) ${likeFields} ${userSelection}`;

const listActivityFields = `
  ... on ListActivity {
    id createdAt status progress ${socialFields} ${userSelection}
    media { id type title { romaji english native userPreferred } coverImage { medium large } }
  }
`;
const textActivityFields = `... on TextActivity { id createdAt text(asHtml: true) ${socialFields} ${userSelection} }`;

/** `filter` is spliced into `activities(…)`, e.g. "isFollowing: true" or "userId: $userId". */
const activityQuery = (variables: string, filter: string) => `
  query ($page: Int${variables}) {
    Page(page: $page, perPage: 20) {
      pageInfo { hasNextPage currentPage }
      activities(${filter}, type_in: [ANIME_LIST, MANGA_LIST, TEXT], sort: ID_DESC) {
        __typename
        ${listActivityFields}
        ${textActivityFields}
      }
    }
  }
`;

const followingActivityQuery = activityQuery('', 'isFollowing: true');
const userActivityQuery = activityQuery(', $userId: Int', 'userId: $userId');

type ListFields = Omit<Extract<Activity, { kind: 'list' }>, 'kind' | 'score'>;
type TextFields = Omit<Extract<Activity, { kind: 'text' }>, 'kind'>;
type RawListActivity = { __typename: 'ListActivity' } & ListFields;
type RawActivity = RawListActivity | ({ __typename: 'TextActivity' | 'MessageActivity' } & TextFields);

const scoreKey = (userId: number, mediaId: number) => `${userId}:${mediaId}`;

// <-- La note n'a de sens qu'en fin de parcours : une série terminée, revue ou abandonnée, jamais un épisode en cours -->
const scoredStatuses = new Set(['completed', 'rewatched', 'reread', 'dropped']);
const isScoredActivity = (raw: RawActivity): raw is RawListActivity => raw.__typename === 'ListActivity' && scoredStatuses.has(raw.status.toLowerCase());

function normalize(raw: RawActivity, scores: Map<string, number>): Activity {
  if (raw.__typename === 'ListActivity') {
    const { __typename, ...activity } = raw;
    const score = isScoredActivity(raw) ? scores.get(scoreKey(raw.user.id, raw.media.id)) : undefined;
    return { kind: 'list', ...activity, score: score || null };
  }
  const { __typename, ...activity } = raw;
  return { kind: __typename === 'TextActivity' ? 'text' : 'message', ...activity };
}

const maxScorePages = 3;

// <-- AniList croise chaque utilisateur avec chaque média demandé : seules les paires des activités sont gardées -->
const completedScoresQuery = `
  query ($page: Int, $userIds: [Int], $mediaIds: [Int], $scoreFormat: ScoreFormat) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      mediaList(userId_in: $userIds, mediaId_in: $mediaIds) { userId mediaId score(format: $scoreFormat) }
    }
  }
`;

/** Current scores of the users who completed or dropped a media in these activities, keyed by `scoreKey`. */
async function fetchCompletedScores(activities: RawActivity[], scoreFormat: ScoreFormat): Promise<Map<string, number>> {
  const completions = activities.filter(isScoredActivity);
  const scores = new Map<string, number>();
  if (!completions.length) return scores;

  const wanted = new Set(completions.map((raw) => scoreKey(raw.user.id, raw.media.id)));
  const userIds = [...new Set(completions.map((raw) => raw.user.id))];
  const mediaIds = [...new Set(completions.map((raw) => raw.media.id))];
  for (let page = 1; page <= maxScorePages; page++) {
    const { Page } = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; mediaList: { userId: number; mediaId: number; score: number }[] } }>(
      completedScoresQuery,
      { page, userIds, mediaIds, scoreFormat },
    );
    for (const entry of Page.mediaList) {
      const key = scoreKey(entry.userId, entry.mediaId);
      if (wanted.has(key)) scores.set(key, entry.score);
    }
    if (!Page.pageInfo.hasNextPage) break;
  }
  return scores;
}

async function fetchActivities(
  query: string,
  variables: Record<string, unknown>,
  scoreFormat: ScoreFormat,
  keep: (raw: RawActivity) => boolean,
): Promise<ActivityPage> {
  const { Page } = await gql<{ Page: { pageInfo: PageInfo; activities: (RawActivity | null)[] } }>(query, variables);
  const kept = Page.activities.filter((raw): raw is RawActivity => raw?.id != null && keep(raw));
  const scores = await fetchCompletedScores(kept, scoreFormat);
  return { pageInfo: Page.pageInfo, activities: kept.map((raw) => normalize(raw, scores)) };
}

/** Activity from followed users, newest first. AniList's following feed includes the viewer, so they are filtered out. */
export function fetchFriendActivity(viewerId: number, scoreFormat: ScoreFormat, page = 1): Promise<ActivityPage> {
  return fetchActivities(followingActivityQuery, { page }, scoreFormat, (raw) => raw.user.id !== viewerId);
}

export function fetchUserActivity(userId: number, scoreFormat: ScoreFormat, page = 1): Promise<ActivityPage> {
  return fetchActivities(userActivityQuery, { page, userId }, scoreFormat, () => true);
}

// <-- Sur un message, l'auteur s'appelle `messenger` et le texte `message` : les alias rejoignent la forme d'un statut -->
const singleActivityQuery = `
  query ($id: Int) {
    Activity(id: $id) {
      __typename
      ${listActivityFields}
      ${textActivityFields}
      ... on MessageActivity {
        id createdAt text: message(asHtml: true) ${socialFields}
        user: messenger { id name avatar { medium } }
      }
    }
  }
`;

export async function fetchActivity(id: number, scoreFormat: ScoreFormat): Promise<Activity> {
  const { Activity } = await gql<{ Activity: RawActivity }>(singleActivityQuery, { id });
  return normalize(Activity, await fetchCompletedScores([Activity], scoreFormat));
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

const statusMarkdownQuery = `
  query ($id: Int) { Activity(id: $id) { ... on TextActivity { text } } }
`;

/** A status as typed (markdown), for editing: the feed only holds AniList's HTML. */
export async function fetchStatusMarkdown(id: number): Promise<string> {
  const { Activity } = await gql<{ Activity: { text?: string } }>(statusMarkdownQuery, { id });
  return Activity.text ?? '';
}

const editStatusMutation = `
  mutation ($id: Int, $text: String) { SaveTextActivity(id: $id, text: $text) { text(asHtml: true) } }
`;

/** Replaces a status's text; returns the new HTML. */
export async function editStatus(id: number, text: string): Promise<string> {
  const { SaveTextActivity } = await gql<{ SaveTextActivity: { text: string } }>(editStatusMutation, { id, text });
  return SaveTextActivity.text;
}

const deleteActivityMutation = `
  mutation ($id: Int) { DeleteActivity(id: $id) { deleted } }
`;

export async function deleteActivity(id: number): Promise<void> {
  await gql(deleteActivityMutation, { id });
}

export type LikeTarget = 'ACTIVITY' | 'ACTIVITY_REPLY';

/** An activity or a reply: anything with a heart. */
export type Likeable = Social & { id: number };

const toggleLikeMutation = `
  mutation ($id: Int, $type: LikeableType) {
    ToggleLikeV2(id: $id, type: $type) {
      ... on ListActivity { likeCount isLiked }
      ... on TextActivity { likeCount isLiked }
      ... on MessageActivity { likeCount isLiked }
      ... on ActivityReply { likeCount isLiked }
    }
  }
`;

type LikeState = Pick<Social, 'likeCount' | 'isLiked'>;

/** Likes or unlikes, returning AniList's resulting state (the list of likers is kept by the caller). */
export async function toggleLike(id: number, type: LikeTarget): Promise<LikeState> {
  const { ToggleLikeV2 } = await gql<{ ToggleLikeV2: LikeState }>(toggleLikeMutation, { id, type });
  return ToggleLikeV2;
}
