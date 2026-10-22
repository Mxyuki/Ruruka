import { SvelteMap } from 'svelte/reactivity';
import { fetchMediaSummaries, searchMediaByTitle } from '../api/queries/media';
import type { MediaSummary } from '../api/types';
import { invoke, type EpisodeFile, type FolderLink, type LibraryFolder } from '../lib/bridge';
import { rankMatches, type MatchCandidate, type ScoredMatch } from '../lib/titleMatch';
import { mediaList } from './mediaList.svelte';
import { session } from './session.svelte';
import { toasts } from './toasts.svelte';

/** Similarity (0–1) needed to link a folder without asking. Lower means more automatic but riskier links. */
const autoLinkThreshold = 0.86;
/** How far the best match must lead the runner-up, so near-ties ("Show" vs "Show CM") go to the user. */
const autoLinkMargin = 0.05;

function confidentMatch<T>(ranked: ScoredMatch<T>[]): T | null {
  const [best, runnerUp] = ranked;
  if (!best || best.score < autoLinkThreshold) return null;
  const isClearWinner = best.score === 1 || !runnerUp || best.score - runnerUp.score >= autoLinkMargin;
  return isClearWinner ? best.item : null;
}

export type LibraryStatus = 'idle' | 'scanning' | 'matching';

const candidateTitles = (media: MediaSummary) =>
  [media.title.romaji, media.title.english, media.title.native, media.title.userPreferred, ...media.synonyms]
    .filter((title): title is string => Boolean(title));

class LibraryStore {
  folders = $state<LibraryFolder[]>([]);
  links = $state<Record<string, FolderLink>>({});
  status = $state<LibraryStatus>('idle');
  matchProgress = $state({ done: 0, total: 0 });
  /** Best search results for folders that couldn't be linked automatically, shown in the manual picker. */
  suggestions = new SvelteMap<string, MediaSummary[]>();
  /** Titles and covers for linked media, including ones not on the user's list. */
  mediaById = new SvelteMap<number, MediaSummary>();

  hasRoot = $derived(Boolean(session.settings?.libraryRoot));

  async refresh(): Promise<void> {
    if (!this.hasRoot || this.status !== 'idle') return;
    this.status = 'scanning';
    try {
      const [folders, links] = await Promise.all([invoke('library.scan'), invoke('library.getLinks')]);
      this.folders = folders;
      this.links = links;
      await this.loadLinkedMedia();
      await this.autoMatch(folders.filter((folder) => !this.links[folder.name]));
    } catch (error) {
      toasts.error(error, 'Impossible de lire tes dossiers');
    } finally {
      this.status = 'idle';
    }
  }

  linkFor(folderName: string): FolderLink | undefined {
    return this.links[folderName];
  }

  foldersFor(mediaId: number): LibraryFolder[] {
    return this.folders.filter((folder) => this.links[folder.name]?.mediaId === mediaId);
  }

  /** Episode files for a media keyed by AniList episode number, with each folder's offset applied. */
  episodesFor(mediaId: number): Map<number, EpisodeFile> {
    const episodes = new Map<number, EpisodeFile>();
    for (const folder of this.foldersFor(mediaId)) {
      const offset = this.links[folder.name]?.episodeOffset ?? 0;
      for (const file of folder.episodes) {
        if (file.number === null) continue;
        const number = file.number - offset;
        if (number > 0 && !episodes.has(number)) episodes.set(number, file);
      }
    }
    return episodes;
  }

  async link(folder: LibraryFolder, media: MediaSummary): Promise<void> {
    this.mediaById.set(media.id, media);
    this.suggestions.delete(folder.name);
    await this.saveLink(folder.name, { mediaId: media.id, kind: 'manual', episodeOffset: this.links[folder.name]?.episodeOffset ?? 0 });
  }

  /** Marks a folder as deliberately unlinked so auto-matching leaves it alone. */
  async unlink(folder: LibraryFolder): Promise<void> {
    await this.saveLink(folder.name, { mediaId: null, kind: 'manual', episodeOffset: 0 });
  }

  async setEpisodeOffset(folder: LibraryFolder, episodeOffset: number): Promise<void> {
    const link = this.links[folder.name];
    if (link) await this.saveLink(folder.name, { ...link, episodeOffset });
  }

  async retryMatch(folder: LibraryFolder): Promise<void> {
    await invoke('library.removeLink', { folderName: folder.name });
    delete this.links[folder.name];
    this.status = 'matching';
    try {
      await this.autoMatch([folder]);
    } finally {
      this.status = 'idle';
    }
  }

  private async autoMatch(folders: LibraryFolder[]): Promise<void> {
    if (!folders.length) return;
    this.status = 'matching';
    this.matchProgress = { done: 0, total: folders.length };
    await mediaList.load('ANIME');
    const ownCandidates: MatchCandidate<MediaSummary>[] = mediaList
      .list('ANIME')
      .map((entry) => ({ item: entry.media, titles: candidateTitles(entry.media) }));

    for (const folder of folders) {
      try {
        await this.matchFolder(folder, ownCandidates);
      } catch (error) {
        toasts.error(error, `Impossible de trouver « ${folder.name} »`);
      }
      this.matchProgress.done++;
    }
  }

  // <-- On cherche d'abord dans ta propre liste : c'est gratuit et presque toujours là -->
  private async matchFolder(folder: LibraryFolder, ownCandidates: MatchCandidate<MediaSummary>[]): Promise<void> {
    const ownMatch = confidentMatch(rankMatches(folder.guessedTitle, ownCandidates));
    if (ownMatch) return this.autoLink(folder, ownMatch);

    const results = await searchMediaByTitle(folder.guessedTitle);
    const ranked = rankMatches(folder.guessedTitle, results.map((media) => ({ item: media, titles: candidateTitles(media) })));
    const searchMatch = confidentMatch(ranked);
    if (searchMatch) return this.autoLink(folder, searchMatch);

    this.suggestions.set(folder.name, ranked.slice(0, 5).map((match) => match.item));
    await this.saveLink(folder.name, { mediaId: null, kind: 'unmatched', episodeOffset: 0 });
  }

  private async autoLink(folder: LibraryFolder, media: MediaSummary): Promise<void> {
    this.mediaById.set(media.id, media);
    await this.saveLink(folder.name, { mediaId: media.id, kind: 'auto', episodeOffset: 0 });
  }

  private async saveLink(folderName: string, link: FolderLink): Promise<void> {
    await invoke('library.setLink', { folderName, link });
    this.links[folderName] = link;
  }

  private async loadLinkedMedia(): Promise<void> {
    await mediaList.load('ANIME');
    const ownMedia = mediaList.list('ANIME').map((entry) => entry.media);
    for (const media of ownMedia) this.mediaById.set(media.id, media);
    const missing = [...new Set(Object.values(this.links).map((link) => link.mediaId))]
      .filter((id): id is number => id !== null && !this.mediaById.has(id));
    for (const media of await fetchMediaSummaries(missing)) this.mediaById.set(media.id, media);
  }
}

export const library = new LibraryStore();
