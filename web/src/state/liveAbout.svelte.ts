import { saveAbout } from '../api/queries/user';
import type { ListEntry, MediaSummary } from '../api/types';
import { fillAboutTemplate, formatClock, hasLiveTags, type LiveAboutState, type LiveAboutValues } from '../lib/aboutTemplate';
import { on, type BridgeEvents } from '../lib/bridge';
import { mediaList } from './mediaList.svelte';
import { playback } from './playback.svelte';
import { session } from './session.svelte';
import { toasts } from './toasts.svelte';

// <-- AniList tolère 30 à 90 requêtes par minute selon sa charge ; 4 par minute laissent de la marge au reste de l'appli -->
const minPushIntervalMs = 15_000;
// <-- Le premier « player.progress » arrive avant la réponse de player.play, donc avant que la lecture en cours soit connue -->
const settleDelayMs = 1_000;

type Position = BridgeEvents['player.progress'];

/**
 * Keeps the profile "about" in sync with playback when it uses live tags. The template stays on
 * this PC (settings); AniList only ever receives the filled-in text.
 */
class LiveAbout {
  private position: Position | null = null;
  private lastPushedText: string | null = null;
  private lastPushAt = 0;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  get template(): string {
    return session.settings?.aboutTemplate ?? '';
  }

  init(): void {
    // <-- Pas de mise à jour sur « player.started » : la durée n'est connue qu'au premier « player.progress » -->
    on('player.progress', (position) => this.track(position));
    on('player.closed', () => this.track(null));
  }

  /** Publishes `text` as the about; with live tags it is kept as the template and published filled in. */
  async save(text: string): Promise<void> {
    const template = hasLiveTags(text) ? text : '';
    if (template !== this.template) await session.updateSettings({ aboutTemplate: template });
    await this.publish(template ? fillAboutTemplate(template, this.currentState()) : text);
  }

  /** The state used to fill the template; while nothing plays, `isWatching` previews with sample values. */
  previewState(isWatching: boolean): LiveAboutState {
    const current = this.currentState();
    if (current.isWatching || !isWatching) return current;
    const last = lastWatchedEntry();
    const sample = { mediaId: 0, episode: 0, positionSeconds: 754, durationSeconds: 1420 };
    return { isWatching: true, values: valuesFor(last?.media ?? null, (last?.progress ?? 0) + 1, sample) };
  }

  /** Publishes the idle version right away, even if mpv still plays: once the app quits nothing keeps it updated. */
  async publishIdle(): Promise<void> {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = null;
    if (!hasLiveTags(this.template)) return;
    try {
      await this.publish(fillAboutTemplate(this.template, this.idleState()));
    } catch (error) {
      toasts.error(error, 'Impossible de remettre ton profil au repos');
    }
  }

  private track(position: Position | null): void {
    this.position = position;
    if (!hasLiveTags(this.template) || this.pushTimer) return;
    const delay = Math.max(settleDelayMs, this.lastPushAt + minPushIntervalMs - Date.now());
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.pushTemplate();
    }, delay);
  }

  private async pushTemplate(): Promise<void> {
    if (!hasLiveTags(this.template)) return;
    try {
      await this.publish(fillAboutTemplate(this.template, this.currentState()));
    } catch (error) {
      toasts.error(error, 'Impossible de mettre à jour ton profil en direct');
    }
  }

  private async publish(text: string): Promise<void> {
    const name = session.viewer?.name;
    if (!name || text === this.lastPushedText) return;
    this.lastPushAt = Date.now();
    await saveAbout(name, text);
    this.lastPushedText = text;
  }

  private currentState(): LiveAboutState {
    const playing = playback.nowPlaying;
    if (playing) {
      const isSameEpisode = this.position?.mediaId === playing.media.id && this.position.episode === playing.episode;
      return { isWatching: true, values: valuesFor(playing.media, playing.episode, isSameEpisode ? this.position : null) };
    }
    return this.idleState();
  }

  private idleState(): LiveAboutState {
    const last = lastWatchedEntry();
    return { isWatching: false, values: valuesFor(last?.media ?? null, last?.progress ?? 0, null) };
  }
}

// <-- Au repos, les balises parlent du dernier anime mis à jour dans la liste -->
function lastWatchedEntry(): ListEntry | null {
  return mediaList
    .list('ANIME')
    .filter((entry) => entry.progress > 0)
    .reduce<ListEntry | null>((latest, entry) => (!latest || entry.updatedAt > latest.updatedAt ? entry : latest), null);
}

function valuesFor(media: MediaSummary | null, episode: number, position: Position | null): LiveAboutValues {
  const time = position?.positionSeconds ?? 0;
  const duration = position?.durationSeconds ?? 0;
  return {
    anime: media?.title.userPreferred ?? '',
    episode: episode ? String(episode) : '',
    episodes: media?.episodes ? String(media.episodes) : '?',
    time: position ? formatClock(time) : '',
    duration: duration ? formatClock(duration) : '',
    remaining: duration ? formatClock(duration - time) : '',
    percent: duration ? String(Math.round((time / duration) * 100)) : '',
    cover: media?.coverImage.large ?? '',
    banner: media?.bannerImage ?? '',
    link: media ? `https://anilist.co/anime/${media.id}` : '',
    updated: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export const liveAbout = new LiveAbout();
