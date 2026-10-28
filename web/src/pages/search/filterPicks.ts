import type { MediaListStatus } from '../../api/types';

/** A genre or tag chosen in Explorer, either required or excluded. */
export interface FilterPick {
  name: string;
  isExcluded: boolean;
  /** Tags only: the minimum % of AniList users who voted the tag relevant. */
  minimumRank?: number;
}

/** AniList's own default when no minimum is given. */
export const defaultTagRank = 18;

/** Adds the name as a required pick, or removes it when it was already picked. */
export function togglePick(picks: FilterPick[], name: string, minimumRank?: number): FilterPick[] {
  if (picks.some((pick) => pick.name === name)) return picks.filter((pick) => pick.name !== name);
  return [...picks, { name, isExcluded: false, minimumRank }];
}

export function updatePick(picks: FilterPick[], name: string, changes: Partial<FilterPick>): FilterPick[] {
  return picks.map((pick) => (pick.name === name ? { ...pick, ...changes } : pick));
}

export const requiredNames = (picks: FilterPick[]) => picks.filter((pick) => !pick.isExcluded).map((pick) => pick.name);
export const excludedNames = (picks: FilterPick[]) => picks.filter((pick) => pick.isExcluded).map((pick) => pick.name);

/** A list status to keep in Explorer, or NONE for media not on the viewer's list. */
export type ListChoice = MediaListStatus | 'NONE';

/** The part AniList can filter itself: only on the list, only off it, or either (undefined). */
export function onListFor(choices: ListChoice[]): boolean | undefined {
  if (!choices.length) return undefined;
  if (!choices.includes('NONE')) return true;
  return choices.length === 1 ? false : undefined;
}

/** Whether the statuses must still be checked here once AniList has applied `onListFor`. */
export const needsStatusCheck = (choices: ListChoice[]) => choices.length > 0 && !(choices.length === 1 && choices[0] === 'NONE');
