import { fetchMediaSummaries } from '../api/queries/media';
import type { MediaSummary } from '../api/types';
import { joinRelayRoom, type RelayMessage, type RelayRoom } from '../api/watchRelay';
import { on } from '../lib/bridge';
import { createWatchCode, normalizeWatchCode } from '../lib/watchCode';
import { liveAbout } from './liveAbout.svelte';
import { mediaList } from './mediaList.svelte';
import { playback } from './playback.svelte';
import { session } from './session.svelte';
import { toasts } from './toasts.svelte';

const stateChannel = 'state';
const friendsChannel = 'friends';
const reconnectDelaysMs = [2_000, 5_000, 15_000, 30_000, 60_000];

export type GroupWatchRole = 'idle' | 'hosting' | 'joined';

/** The episode on the host's mpv. */
export interface SharedEpisode {
  mediaId: number;
  episode: number;
  positionSeconds: number;
  durationSeconds: number;
  isWatched: boolean;
}

/**
 * What the host sends, retained by the relay so a friend joining late gets it at once.
 * "lost" is the host's last will: the relay sends it when the host drops without closing.
 */
interface HostState {
  status: 'playing' | 'idle' | 'lost' | 'ended';
  hostName: string;
  /** Changes at each host connection, so friends know to say hello again. */
  connectionId: string;
  shared: SharedEpisode | null;
}

interface FriendNotice {
  type: 'join' | 'leave';
  friendId: string;
  name: string;
}

export interface Friend {
  friendId: string;
  name: string;
}

/** The host's session as a friend sees it. */
export interface RemoteSession {
  hostName: string;
  status: HostState['status'];
  shared: (SharedEpisode & { media: MediaSummary }) | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function asSharedEpisode(value: unknown): SharedEpisode | null {
  if (!isRecord(value)) return null;
  const { mediaId, episode, positionSeconds, durationSeconds, isWatched } = value;
  if (typeof mediaId !== 'number' || typeof episode !== 'number' || typeof isWatched !== 'boolean') return null;
  if (typeof positionSeconds !== 'number' || typeof durationSeconds !== 'number') return null;
  return { mediaId, episode, positionSeconds, durationSeconds, isWatched };
}

function asHostState(value: unknown): HostState | null {
  if (!isRecord(value)) return null;
  const { status, hostName, connectionId, shared } = value;
  if (status !== 'playing' && status !== 'idle' && status !== 'lost' && status !== 'ended') return null;
  if (typeof hostName !== 'string' || typeof connectionId !== 'string') return null;
  return { status, hostName, connectionId, shared: asSharedEpisode(shared) };
}

function asFriendNotice(value: unknown): FriendNotice | null {
  if (!isRecord(value)) return null;
  const { type, friendId, name } = value;
  if ((type !== 'join' && type !== 'leave') || typeof friendId !== 'string' || typeof name !== 'string') return null;
  return { type, friendId, name };
}

/**
 * Group watch through a public relay. The host shares what its mpv plays; each friend's Ruruka
 * treats it as its own playback, so their list and live about follow along.
 */
class GroupWatch {
  role = $state<GroupWatchRole>('idle');
  code = $state<string | null>(null);
  isConnecting = $state(false);
  isReconnecting = $state(false);
  /** Host side: the friends in the session. */
  friends = $state<Friend[]>([]);
  /** Host side: the episode this PC's mpv plays, shared as soon as a session opens. */
  shared = $state<SharedEpisode | null>(null);
  /** Friend side: the host's session. */
  remote = $state<RemoteSession | null>(null);

  private room: RelayRoom | null = null;
  private connectionId = '';
  private readonly friendId = crypto.randomUUID();
  private hostConnectionId: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingStates: Promise<void> = Promise.resolve();

  init(): void {
    on('player.started', ({ mediaId, episode }) => this.share({ mediaId, episode, positionSeconds: 0, durationSeconds: 0, isWatched: false }));
    on('player.progress', (position) => this.share({ ...position, isWatched: this.isSharing(position) && (this.shared?.isWatched ?? false) }));
    on('player.watched', (episode) => {
      if (this.shared && this.isSharing(episode)) this.share({ ...this.shared, isWatched: true });
    });
    on('player.closed', (episode) => {
      if (this.isSharing(episode)) this.share(null);
    });
  }

  /** Opens a session with a new code to give to friends. */
  async host(): Promise<void> {
    await this.connect(createWatchCode(), 'hosting');
  }

  /** Joins the session behind a code typed by the user. */
  async join(typedCode: string): Promise<void> {
    const code = normalizeWatchCode(typedCode);
    if (!code) throw new Error('Ce code ne ressemble pas à un code de séance (10 lettres et chiffres).');
    await this.connect(code, 'joined');
  }

  /** Closes the session as host, or leaves it as a friend. */
  async leave(): Promise<void> {
    const room = this.room;
    const role = this.role;
    this.reset();
    if (!room) return;
    try {
      if (role === 'hosting') await room.publish(stateChannel, this.hostState('ended'), true);
      else await room.publish(friendsChannel, this.notice('leave'), false);
    } catch (error) {
      toasts.error(error, 'Impossible de prévenir la séance de ton départ');
    } finally {
      room.close();
    }
  }

  private async connect(code: string, role: Exclude<GroupWatchRole, 'idle'>): Promise<void> {
    if (this.room || this.isConnecting) return;
    this.isConnecting = true;
    this.connectionId = crypto.randomUUID();
    try {
      this.room = await joinRelayRoom({
        code,
        channels: [role === 'hosting' ? friendsChannel : stateChannel],
        lastWill:
          role === 'hosting'
            ? { channel: stateChannel, payload: this.hostState('lost'), isRetained: true }
            : { channel: friendsChannel, payload: this.notice('leave'), isRetained: false },
        onMessage: (message) => (role === 'hosting' ? this.handleFriendNotice(message) : this.queueHostState(message)),
        onClose: () => this.handleConnectionLost(code, role),
      });
      this.code = code;
      this.role = role;
      this.reconnectAttempt = 0;
      this.isReconnecting = false;
      if (role === 'hosting') await this.publishHostState();
      else await this.room.publish(friendsChannel, this.notice('join'), false);
    } finally {
      this.isConnecting = false;
    }
  }

  // <-- Coupure réseau : on retente quelques fois avec le même code, la séance n'est pas finie pour autant -->
  private handleConnectionLost(code: string, role: Exclude<GroupWatchRole, 'idle'>): void {
    this.room = null;
    const delay = reconnectDelaysMs[this.reconnectAttempt];
    if (delay === undefined) {
      this.reset();
      toasts.error('La connexion au relais est perdue, la séance est terminée.');
      return;
    }
    this.isReconnecting = true;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(code, role).catch(() => this.handleConnectionLost(code, role));
    }, delay);
  }

  private reset(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopFollowing();
    this.room = null;
    this.role = 'idle';
    this.code = null;
    this.isReconnecting = false;
    this.reconnectAttempt = 0;
    this.friends = [];
    this.remote = null;
    this.hostConnectionId = null;
  }

  private isSharing(episode: { mediaId: number; episode: number }): boolean {
    return this.shared?.mediaId === episode.mediaId && this.shared.episode === episode.episode;
  }

  private share(shared: SharedEpisode | null): void {
    this.shared = shared;
    if (this.role === 'hosting') void this.publishHostState();
  }

  private hostState(status: HostState['status']): HostState {
    return { status, hostName: session.viewer?.name ?? 'Un détective', connectionId: this.connectionId, shared: this.shared };
  }

  private notice(type: FriendNotice['type']): FriendNotice {
    return { type, friendId: this.friendId, name: session.viewer?.name ?? 'Un détective' };
  }

  private async publishHostState(): Promise<void> {
    try {
      await this.room?.publish(stateChannel, this.hostState(this.shared ? 'playing' : 'idle'), true);
    } catch (error) {
      toasts.error(error, 'Impossible de partager l’épisode avec la séance');
    }
  }

  private handleFriendNotice({ channel, payload }: RelayMessage): void {
    const notice = channel === friendsChannel ? asFriendNotice(payload) : null;
    if (!notice) return;
    const others = this.friends.filter((friend) => friend.friendId !== notice.friendId);
    const isNew = others.length === this.friends.length;
    if (notice.type === 'leave') {
      if (!isNew) toasts.show(`${notice.name} a quitté la séance.`, 'info');
      this.friends = others;
      return;
    }
    if (isNew) toasts.show(`${notice.name} a rejoint la séance !`, 'info');
    this.friends = [...others, { friendId: notice.friendId, name: notice.name }];
  }

  // <-- Les états sont traités dans l'ordre d'arrivée, même quand il faut d'abord charger l'anime -->
  private queueHostState({ channel, payload, isRetained }: RelayMessage): void {
    const state = channel === stateChannel ? asHostState(payload) : null;
    if (!state) return;
    this.pendingStates = this.pendingStates
      .then(() => this.applyHostState(state, isRetained))
      .catch((error: unknown) => toasts.error(error, 'Impossible de suivre l’épisode de la séance'));
  }

  private async applyHostState(state: HostState, isRetained: boolean): Promise<void> {
    if (this.role !== 'joined') return;
    // <-- L'hôte s'est reconnecté : il a oublié qui était là, on se présente à nouveau -->
    if (this.hostConnectionId && this.hostConnectionId !== state.connectionId) void this.room?.publish(friendsChannel, this.notice('join'), false);
    this.hostConnectionId = state.connectionId;

    if (state.status === 'ended') {
      await this.leave();
      toasts.show(isRetained ? 'Cette séance est déjà terminée.' : `${state.hostName} a fermé la séance.`, 'info');
      return;
    }
    const previous = this.remote?.shared;
    if (state.status !== 'playing' || !state.shared) {
      this.remote = { hostName: state.hostName, status: state.status, shared: null };
      this.stopFollowing();
      return;
    }

    const shared = state.shared;
    const media = previous?.mediaId === shared.mediaId ? previous.media : await mediaFor(shared.mediaId);
    if (this.role !== 'joined') return;
    this.remote = { hostName: state.hostName, status: state.status, shared: { ...shared, media } };
    if (!playback.followRemote(media, shared.episode)) return;
    liveAbout.trackPosition({ mediaId: shared.mediaId, episode: shared.episode, positionSeconds: shared.positionSeconds, durationSeconds: shared.durationSeconds });

    // <-- Seul un passage à « vu » observé en direct compte : arriver après coup ne coche pas l'épisode -->
    const isSameEpisode = previous?.mediaId === shared.mediaId && previous.episode === shared.episode;
    if (shared.isWatched && !isRetained && isSameEpisode && !previous.isWatched) playback.recordRemoteWatched();
  }

  private stopFollowing(): void {
    if (!playback.nowPlaying?.isRemote) return;
    playback.stopFollowingRemote();
    liveAbout.trackPosition(null);
  }
}

async function mediaFor(mediaId: number): Promise<MediaSummary> {
  const known = mediaList.entryFor(mediaId)?.media;
  if (known) return known;
  const [media] = await fetchMediaSummaries([mediaId]);
  if (!media) throw new Error('Cet anime est introuvable sur AniList.');
  return media;
}

export const groupWatch = new GroupWatch();
