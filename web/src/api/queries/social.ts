import { gql } from '../client';
import { cached, minuteMs } from '../cache';

export interface SocialUser {
  id: number;
  name: string;
  avatar: { medium: string };
}

export type Relation = 'following' | 'followers';

const relationQuery = (relation: Relation) => `
  query ($userId: Int!, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      ${relation}(userId: $userId, sort: USERNAME) { id name avatar { medium } }
    }
  }
`;

// <-- Limite de pages : assez pour presque tout le monde, sans épuiser le quota AniList -->
const maxPages = 10;

/** Everyone a user follows, or everyone following them, alphabetically. */
export function fetchRelation(userId: number, relation: Relation): Promise<SocialUser[]> {
  return cached(`social:${relation}:${userId}`, 5 * minuteMs, async () => {
    const users: SocialUser[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const result = await gql<{ Page: { pageInfo: { hasNextPage: boolean } } & Record<Relation, SocialUser[]> }>(
        relationQuery(relation),
        { userId, page },
      );
      users.push(...result.Page[relation]);
      if (!result.Page.pageInfo.hasNextPage) break;
    }
    return users;
  });
}

