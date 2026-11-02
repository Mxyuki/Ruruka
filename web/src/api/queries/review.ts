import { gql } from '../client';
import type { MediaTitle, MediaType, PageInfo } from '../types';

export interface Review {
  id: number;
  summary: string;
  /** Raw AniList markdown, rendered by `renderAniListMarkdown`. */
  body: string;
  /** Out of 100. */
  score: number;
  /** Readers who found it helpful, out of `ratingAmount`. */
  rating: number;
  ratingAmount: number;
  createdAt: number;
  media: { id: number; type: MediaType; title: Pick<MediaTitle, 'userPreferred'>; coverImage: { medium: string } };
}

interface ReviewPage {
  pageInfo: PageInfo;
  reviews: Review[];
}

const userReviewsQuery = `
  query ($userId: Int, $page: Int) {
    Page(page: $page, perPage: 10) {
      pageInfo { hasNextPage currentPage }
      reviews(userId: $userId, sort: CREATED_AT_DESC) {
        id summary body score rating ratingAmount createdAt
        media { id type title { userPreferred } coverImage { medium } }
      }
    }
  }
`;

/** A user's reviews, newest first, 10 per page. */
export async function fetchUserReviews(userId: number, page: number): Promise<ReviewPage> {
  const { Page } = await gql<{ Page: ReviewPage }>(userReviewsQuery, { userId, page });
  return Page;
}
