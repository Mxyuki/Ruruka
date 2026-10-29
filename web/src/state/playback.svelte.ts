import type { MediaSummary } from '../api/types';
import { invoke, on } from '../lib/bridge';
import { library } from './library.svelte';
import { mediaList } from './mediaList.svelte';
import { session } from './session.svelte';
import { toasts } from './toasts.svelte';

export interface SkipPrompt {
  media: MediaSummary;
  requested: number;
  suggested: number;
  hasSuggestedFile: boolean;
}

/** The user's answer to a skip prompt: play `episode`, then chain the next ones up to `lastEpisode`. */
interface PlayChoice {
  episode: number;
  lastEpisode: number;
}

interface Playlist {
  mediaId: number;
  lastEpisode: number;
}

interface NowPlaying {
  media: MediaSummary;
  episode: number;
  isWatched: boolean;
  hasOfferedNext: boolean;
}

class Playback {
  nowPlaying = $state<NowPlaying | null>(null);
  skipPrompt = $state<SkipPrompt | null>(null);
  private resolveSkipPrompt: ((choice: PlayChoice | null) => void) | null = null;
  private sessions = new Map<string, NowPlaying>();
  private playlist: Playlist | null = null;

  init(): void {
    on('player.watched', ({ mediaId, episode }) => this.handleWatched(mediaId, episode));
    on('player.ended', ({ mediaId, episode }) => this.handleEnded(mediaId, episode));
    on('player.closed', ({ mediaId, episode }) => this.handleClosed(mediaId, episode));
  }

  hasEpisodeFile(mediaId: number, episode: number): boolean {
    return library.episodesFor(mediaId).has(episode);
  }

  /** Plays an episode, first warning when it skips ahead of the list progress. */
  async requestPlay(media: MediaSummary, episode: number): Promise<void> {
    const entry = mediaList.entryFor(media.id);
    const suggested = (entry?.progress ?? 0) + 1;
    const isRewatch = entry?.status === 'COMPLETED';
    const shouldWarn = session.settings?.hasSkipWarning && !isRewatch && episode > suggested;

    const choice = shouldWarn ? await this.askAboutSkip(media, episode, suggested) : { episode, lastEpisode: episode };
    if (!choice) return;
    this.playlist = choice.lastEpisode > choice.episode ? { mediaId: media.id, lastEpisode: choice.lastEpisode } : null;
    await this.play(media, choice.episode);
  }

  /** Answers the skip prompt; a `lastEpisode` past `episode` chains the following episodes in mpv on their own. */
  answerSkipPrompt(episode: number | null, lastEpisode?: number): void {
    this.resolveSkipPrompt?.(episode === null ? null : { episode, lastEpisode: lastEpisode ?? episode });
    this.resolveSkipPrompt = null;
    this.skipPrompt = null;
  }

  private askAboutSkip(media: MediaSummary, requested: number, suggested: number): Promise<PlayChoice | null> {
    this.skipPrompt = { media, requested, suggested, hasSuggestedFile: this.hasEpisodeFile(media.id, suggested) };
    return new Promise((resolve) => {
      this.resolveSkipPrompt = resolve;
    });
  }

  private async play(media: MediaSummary, episode: number): Promise<void> {
    const file = library.episodesFor(media.id).get(episode);
    if (!file) {
      toasts.error(`L’épisode ${episode} n’est pas dans ton dossier.`);
      return;
    }
    try {
      await invoke('player.play', { mediaId: media.id, episode, filePath: file.path, title: media.title.userPreferred });
      const started = { media, episode, isWatched: false, hasOfferedNext: false };
      // <-- L'épisode remplace le précédent dans la même fenêtre mpv, qui ne sera donc jamais « fermé » -->
      if (this.nowPlaying) this.sessions.delete(sessionKey(this.nowPlaying.media.id, this.nowPlaying.episode));
      this.sessions.set(sessionKey(media.id, episode), started);
      this.nowPlaying = started;
    } catch (error) {
      toasts.error(error, 'Impossible de lancer mpv');
    }
  }

  private async handleWatched(mediaId: number, episode: number): Promise<void> {
    const current = this.sessions.get(sessionKey(mediaId, episode));
    if (!current) return;
    current.isWatched = true;
    try {
      const result = await mediaList.recordWatched(current.media, episode);
      if (result === 'updated') toasts.success(`Épisode ${episode} de ${current.media.title.userPreferred} vu !`);
    } catch (error) {
      toasts.error(error, 'Impossible de mettre à jour ta liste');
    }
  }

  private handleEnded(mediaId: number, episode: number): void {
    const current = this.sessions.get(sessionKey(mediaId, episode));
    if (current) this.continueAfter(current, true);
  }

  private handleClosed(mediaId: number, episode: number): void {
    const key = sessionKey(mediaId, episode);
    const finished = this.sessions.get(key);
    this.sessions.delete(key);
    if (this.nowPlaying?.media.id === mediaId && this.nowPlaying.episode === episode) this.nowPlaying = null;
    if (finished) this.continueAfter(finished, false);
  }

  // <-- En enchaînement, l'épisode suivant part tout seul dans la même fenêtre mpv ; sinon on le propose -->
  private continueAfter(finished: NowPlaying, hasReachedEnd: boolean): void {
    if (finished.hasOfferedNext) return;
    const playlist = this.playlist;
    const next = finished.episode + 1;
    if (playlist?.mediaId !== finished.media.id || next > playlist.lastEpisode) {
      this.offerNext(finished);
      return;
    }
    // <-- Sans « garder mpv ouvert », mpv se ferme seul en fin d'épisode : une fermeture avant « vu » est un arrêt voulu -->
    if (!hasReachedEnd && !finished.isWatched) {
      this.playlist = null;
      return;
    }
    finished.hasOfferedNext = true;
    if (!this.hasEpisodeFile(finished.media.id, next)) {
      this.playlist = null;
      toasts.show(`Fin de l’enchaînement : l’épisode ${next} n’est pas dans ton dossier.`, 'info');
      return;
    }
    if (next === playlist.lastEpisode) this.playlist = null;
    toasts.show(`On enchaîne avec l’épisode ${next} !`, 'info');
    void this.play(finished.media, next);
  }

  private offerNext(finished: NowPlaying): void {
    if (!finished.isWatched || finished.hasOfferedNext) return;
    const next = finished.episode + 1;
    if (!this.hasEpisodeFile(finished.media.id, next)) return;
    finished.hasOfferedNext = true;
    toasts.show(`On enchaîne avec l’épisode ${next} ?`, 'info', {
      label: 'Regarder',
      run: () => this.requestPlay(finished.media, next),
    });
  }
}

const sessionKey = (mediaId: number, episode: number) => `${mediaId}:${episode}`;

export const playback = new Playback();
