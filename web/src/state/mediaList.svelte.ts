import { SvelteMap } from 'svelte/reactivity';
import { deleteListEntry, fetchListCollection, saveListEntry } from '../api/queries/list';
import type { ListEntry, ListEntryChanges, MediaSummary, MediaType } from '../api/types';
import { todayAsFuzzyDate } from '../lib/format';
import { session } from './session.svelte';

type EntryState = Pick<ListEntry, 'status' | 'startedAt' | 'completedAt' | 'repeat'>;

/**
 * Mirrors AniList's own list editor: progress starts an entry, the last episode completes it,
 * and finishing a rewatch counts one more repeat.
 */
export function statusChangesFor(entry: EntryState | undefined, progress: number, total: number | null): ListEntryChanges {
  const today = todayAsFuzzyDate();
  const startDate = entry?.startedAt?.year ? {} : { startedAt: today };
  const isFinished = Boolean(total && progress >= total);

  if (isFinished && entry?.status === 'REPEATING') {
    return { status: 'COMPLETED', repeat: entry.repeat + 1 };
  }
  if (isFinished && entry?.status !== 'COMPLETED') {
    return { status: 'COMPLETED', ...startDate, ...(!entry?.completedAt?.year && { completedAt: today }) };
  }
  if (progress > 0 && (!entry || ['PLANNING', 'PAUSED', 'DROPPED'].includes(entry.status))) {
    return { status: 'CURRENT', ...startDate };
  }
  return entry ? {} : { status: 'PLANNING' };
}

export const totalUnits = (media: MediaSummary) => (media.type === 'MANGA' ? media.chapters : media.episodes);

export type WatchResult = 'updated' | 'alreadyWatched';

class MediaListStore {
  private entries = new SvelteMap<number, ListEntry>();
  private loadedTypes = $state<Record<MediaType, boolean>>({ ANIME: false, MANGA: false });
  private pendingLoads = new Map<MediaType, Promise<void>>();

  isLoaded(type: MediaType): boolean {
    return this.loadedTypes[type];
  }

  /** Loads the viewer's list once; later calls reuse it unless `force` is set. */
  load(type: MediaType, force = false): Promise<void> {
    if (this.loadedTypes[type] && !force) return Promise.resolve();
    const existing = this.pendingLoads.get(type);
    if (existing) return existing;

    const viewerId = session.viewer?.id;
    if (!viewerId) return Promise.reject(new Error('Tu n’es pas connecté·e.'));

    const request = fetchListCollection(viewerId, type)
      .then((entries) => {
        for (const [mediaId, entry] of this.entries) {
          if (entry.media.type === type) this.entries.delete(mediaId);
        }
        for (const entry of entries) this.entries.set(entry.mediaId, entry);
        this.loadedTypes[type] = true;
      })
      .finally(() => this.pendingLoads.delete(type));
    this.pendingLoads.set(type, request);
    return request;
  }

  entryFor(mediaId: number): ListEntry | undefined {
    return this.entries.get(mediaId);
  }

  list(type: MediaType): ListEntry[] {
    return [...this.entries.values()].filter((entry) => entry.media.type === type);
  }

  /** Saves changes, adding the status/date changes AniList itself would make for a progress update. */
  async save(media: MediaSummary, changes: ListEntryChanges): Promise<ListEntry> {
    const entry = this.entries.get(media.id);
    const progress = changes.progress ?? entry?.progress ?? 0;
    const automatic = changes.status ? {} : statusChangesFor(entry, progress, totalUnits(media));
    const saved = await saveListEntry(media.id, { ...automatic, ...changes });
    this.entries.set(media.id, saved);
    return saved;
  }

  async remove(entry: ListEntry): Promise<void> {
    await deleteListEntry(entry.id);
    this.entries.delete(entry.mediaId);
  }

  /** Records a read chapter (and its volume) unless the list is already at or past them. */
  async recordRead(media: MediaSummary, chapter: number, volume: number | null): Promise<WatchResult> {
    await this.load(media.type);
    const entry = this.entries.get(media.id);
    const changes: ListEntryChanges = {};
    if ((entry?.progress ?? 0) < chapter) changes.progress = chapter;
    if (volume && (entry?.progressVolumes ?? 0) < volume) changes.progressVolumes = volume;
    if (!Object.keys(changes).length) return 'alreadyWatched';
    await this.save(media, changes);
    return 'updated';
  }

  /** Records a finished episode unless the list is already at or past it. */
  async recordWatched(media: MediaSummary, episode: number): Promise<WatchResult> {
    await this.load(media.type);
    const entry = this.entries.get(media.id);
    if (entry && entry.progress >= episode) return 'alreadyWatched';
    await this.save(media, { progress: episode });
    return 'updated';
  }
}

export const mediaList = new MediaListStore();
