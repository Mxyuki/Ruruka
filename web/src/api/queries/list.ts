import { cached, minuteMs } from '../cache';
import { gql } from '../client';
import type { ListEntry, ListEntryChanges, MediaListStatus, MediaSummary, MediaType, PublicListEntry, ScoreFormat } from '../types';
import { listEntryFields, mediaSummaryFields } from './fragments';

const listCollectionQuery = `
  query ($userId: Int, $type: MediaType) {
    MediaListCollection(userId: $userId, type: $type, forceSingleCompletedList: true) {
      lists { entries { ${listEntryFields} } }
    }
  }
`;

export async function fetchListCollection(userId: number, type: MediaType): Promise<ListEntry[]> {
  const { MediaListCollection } = await gql<{ MediaListCollection: { lists: { entries: ListEntry[] }[] } }>(
    listCollectionQuery,
    { userId, type },
  );
  return uniqueEntries(MediaListCollection.lists);
}

// <-- Les listes perso répètent des entrées déjà présentes : on dédoublonne -->
function uniqueEntries<T extends { id: number }>(lists: { entries: T[] }[]): T[] {
  const byId = new Map<number, T>();
  for (const list of lists) {
    for (const entry of list.entries) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

// <-- La note est convertie par AniList dans le format du lecteur, pour s'afficher comme sa propre liste -->
const userListQuery = `
  query ($userName: String, $type: MediaType, $scoreFormat: ScoreFormat) {
    MediaListCollection(userName: $userName, type: $type, forceSingleCompletedList: true) {
      lists {
        entries {
          id
          mediaId
          status
          progress
          score(format: $scoreFormat)
          updatedAt
          customLists(asArray: true)
          media { ${mediaSummaryFields} }
        }
      }
    }
  }
`;

/** Another user's public list, with scores in `scoreFormat`. Private entries are left out by AniList. */
export function fetchUserList(userName: string, type: MediaType, scoreFormat: ScoreFormat): Promise<PublicListEntry[]> {
  return cached(`userList:${userName.toLowerCase()}:${type}:${scoreFormat}`, 5 * minuteMs, async () => {
    const { MediaListCollection } = await gql<{ MediaListCollection: { lists: { entries: PublicListEntry[] }[] } }>(
      userListQuery,
      { userName, type, scoreFormat },
    );
    return uniqueEntries(MediaListCollection.lists);
  });
}

/** A list entry as the comparison page reads it: both score scales, and what the media is about. */
export interface ComparisonEntry {
  id: number;
  mediaId: number;
  status: MediaListStatus;
  /** 0–100 for the maths; 0 when unscored. */
  score100: number;
  /** In the viewer's format, for display and filters. */
  score: number;
  media: MediaSummary & { genres: string[]; popularity: number | null; tags: { name: string; rank: number; isMediaSpoiler: boolean }[] };
}

const comparisonListQuery = `
  query ($userName: String, $type: MediaType, $scoreFormat: ScoreFormat) {
    MediaListCollection(userName: $userName, type: $type, forceSingleCompletedList: true) {
      lists {
        entries {
          id
          mediaId
          status
          score100: score(format: POINT_100)
          score(format: $scoreFormat)
          media { ${mediaSummaryFields} genres popularity tags { name rank isMediaSpoiler } }
        }
      }
    }
  }
`;

/** A user's whole list with genres and tags, to compare two detectives' tastes. */
export function fetchComparisonList(userName: string, type: MediaType, scoreFormat: ScoreFormat): Promise<ComparisonEntry[]> {
  return cached(`compareList:${userName.toLowerCase()}:${type}:${scoreFormat}`, 5 * minuteMs, async () => {
    const { MediaListCollection } = await gql<{ MediaListCollection: { lists: { entries: ComparisonEntry[] }[] } }>(
      comparisonListQuery,
      { userName, type, scoreFormat },
    );
    return uniqueEntries(MediaListCollection.lists);
  });
}

const saveEntryMutation = `
  mutation (
    $mediaId: Int, $status: MediaListStatus, $progress: Int, $progressVolumes: Int, $score: Float,
    $repeat: Int, $private: Boolean, $notes: String, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput,
    $customLists: [String], $hiddenFromStatusLists: Boolean
  ) {
    SaveMediaListEntry(
      mediaId: $mediaId, status: $status, progress: $progress, progressVolumes: $progressVolumes, score: $score,
      repeat: $repeat, private: $private, notes: $notes, startedAt: $startedAt, completedAt: $completedAt,
      customLists: $customLists, hiddenFromStatusLists: $hiddenFromStatusLists
    ) { ${listEntryFields} }
  }
`;

export async function saveListEntry(mediaId: number, changes: ListEntryChanges): Promise<ListEntry> {
  const { SaveMediaListEntry } = await gql<{ SaveMediaListEntry: ListEntry }>(saveEntryMutation, { mediaId, ...changes });
  return SaveMediaListEntry;
}

const deleteEntryMutation = `
  mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }
`;

export async function deleteListEntry(id: number): Promise<void> {
  await gql(deleteEntryMutation, { id });
}
