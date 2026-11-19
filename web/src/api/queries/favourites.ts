import { gql } from '../client';
import { invalidate } from '../cache';

export type FavouriteKind = 'character' | 'staff' | 'studio';

/** The kinds of favourite a profile lets the person put in order (studios show as names, not pictures). */
export type FavouriteGroup = 'anime' | 'manga' | 'character' | 'staff';

const toggleMutation = `
  mutation ($characterId: Int, $staffId: Int, $studioId: Int) {
    ToggleFavourite(characterId: $characterId, staffId: $staffId, studioId: $studioId) { anime { pageInfo { total } } }
  }
`;

/** Adds the character, staff member or studio to the viewer's favourites, or removes it when it already is one. */
export async function toggleFavourite(kind: FavouriteKind, id: number): Promise<void> {
  await gql(toggleMutation, { [`${kind}Id`]: id });
  invalidate(`${kind}:${id}`);
  invalidate('user:');
}

/** Puts the viewer's favourites of one kind in this order (first = shown first). */
export async function saveFavouriteOrder(group: FavouriteGroup, ids: number[]): Promise<void> {
  const mutation = `
    mutation ($ids: [Int], $order: [Int]) {
      UpdateFavouriteOrder(${group}Ids: $ids, ${group}Order: $order) { anime { pageInfo { total } } }
    }
  `;
  await gql(mutation, { ids, order: ids.map((_, index) => index + 1) });
  invalidate('user:');
}
