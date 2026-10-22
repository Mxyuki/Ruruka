import { gql } from '../client';
import type { ListEntry, ListEntryChanges, MediaType } from '../types';
import { listEntryFields } from './fragments';

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
  // <-- Les listes perso répètent des entrées déjà présentes : on dédoublonne -->
  const byId = new Map<number, ListEntry>();
  for (const list of MediaListCollection.lists) {
    for (const entry of list.entries) byId.set(entry.id, entry);
  }
  return [...byId.values()];
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
