import { fetchMediaSummaries } from '../api/queries/media';
import type { MediaSummary } from '../api/types';
import { joinRelayRoom, type RelayMessage, type RelayRoom } from '../api/watchRelay';
import { invoke, on, type BridgeEvents } from '../lib/bridge';
import { createWatchCode, normalizeWatchCode } from '../lib/watchCode';
import { liveAbout } from './liveAbout.svelte';
import { mediaList } from './mediaList.svelte';
import { playback } from './playback.svelte';
import { session } from './session.svelte';
import { toasts } from './toasts.svelte';

const stateChannel = 'state';
const friendsChannel = 'friends';
const syncChannel = 'sync';
const signalChannel = 'signal';
const controlChannel = 'control';
/** The host's older points are still on their way when a friend acts: following them would undo the action for a moment. */
const controlGraceMs = 1_500;
/** A message older than this has stalled somewhere: it says nothing reliable about the delay. */
const maxSyncLagSeconds = 3;
const reconnectDelaysMs = [2_000, 5_000, 15_000, 30_000, 60_000];

export const hostPeerId = 'host';

export type GroupWatchRole = 'idle' | 'hosting' | 'joined';

/** How friends see the episode: a screen share elsewhere, their own copy in sync, or the host's stream. */
export type WatchMode = 'screen' | 'files' | 'stream';

/** What a friend plays on this PC to stay with the host. */
export type FollowKind = 'none' | 'files' | 'stream';

/** The host's file during a stream; `fileKey` changes with each file, so old requests can't read the new one. */
export interface StreamedFile {
  fileKey: string;
  fileSize: number;
  extension: string;
}

/** Messages on the signal channel; `to` is a friend id or "host". */
export interface StreamSignal {
  type: 'request' | 'admit' | 'refuse' | 'peer';
  from: string;
  to: string;
  name: string;
  signal: unknown;
}

type SyncPoint = BridgeEvents['player.sync'];

interface SyncMessage extends SyncPoint {
  /** The host's clock: the delay it reveals is rough, hence the cap. */
  sentAt: number;
}

/** A friend's pause or seek, sent to the host. */
interface ControlMessage {
  friendId: string;
  mediaId: number;
  episode: number;
  positionSeconds: number | null;
  isPaused: boolean | null;
}

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
  mode: WatchMode;
  stream: StreamedFile | null;
  /** Friends allowed to pause and seek for everyone. */
  controllerIds: string[];
}

interface FriendNotice {
  type: 'join' | 'leave' | 'syncRequest';
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
  mode: WatchMode;
  stream: StreamedFile | null;
  controllerIds: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function asSharedEpisode(value: unknown): SharedEpisode | null {
  if (!isRecord(value)) return null;
  const { mediaId, episode, positionSeconds, durationSeconds, isWatched } = value;
  if (typeof mediaId !== 'number' || typeof episode !== 'number' || typeof isWatched !== 'boolean') return null;
  if (typeof positionSeconds !== 'number' || typeof durationSeconds !== 'number') return null;
  return { mediaId, episode, positionSeconds, durationSeconds, isWatched };
}

function asStreamedFile(value: unknown): StreamedFile | null {
  if (!isRecord(value)) return null;
  const { fileKey, fileSize, extension } = value;
  if (typeof fileKey !== 'string' || typeof fileSize !== 'number' || typeof extension !== 'string') return null;
  return { fileKey, fileSize, extension };
}

function asHostState(value: unknown): HostState | null {
  if (!isRecord(value)) return null;
  const { status, hostName, connectionId, shared, mode, stream, controllerIds } = value;
  if (status !== 'playing' && status !== 'idle' && status !== 'lost' && status !== 'ended') return null;
  if (typeof hostName !== 'string' || typeof connectionId !== 'string') return null;
  const knownMode: WatchMode = mode === 'files' || mode === 'stream' ? mode : 'screen';
  const knownControllerIds = Array.isArray(controllerIds) ? controllerIds.filter((id): id is string => typeof id === 'string') : [];
  return { status, hostName, connectionId, shared: asSharedEpisode(shared), mode: knownMode, stream: asStreamedFile(stream), controllerIds: knownControllerIds };
}

function asControlMessage(value: unknown): ControlMessage | null {
  if (!isRecord(value)) return null;
  const { friendId, mediaId, episode, positionSeconds, isPaused } = value;
  if (typeof friendId !== 'string' || typeof mediaId !== 'number' || typeof episode !== 'number') return null;
  if (positionSeconds !== null && typeof positionSeconds !== 'number') return null;
  if (isPaused !== null && typeof isPaused !== 'boolean') return null;
  return { friendId, mediaId, episode, positionSeconds, isPaused };
}

function asSyncMessage(value: unknown): SyncMessage | null {
  if (!isRecord(value)) return null;
  const { mediaId, episode, positionSeconds, durationSeconds, isPaused, sentAt } = value;
  if (typeof mediaId !== 'number' || typeof episode !== 'number' || typeof positionSeconds !== 'number') return null;
  if (typeof durationSeconds !== 'number' || typeof isPaused !== 'boolean' || typeof sentAt !== 'number') return null;
  return { mediaId, episode, positionSeconds, durationSeconds, isPaused, sentAt };
}

function asStreamSignal(value: unknown): StreamSignal | null {
  if (!isRecord(value)) return null;
  const { type, from, to, name, signal } = value;
  if (type !== 'request' && type !== 'admit' && type !== 'refuse' && type !== 'peer') return null;
  if (typeof from !== 'string' || typeof to !== 'string' || typeof name !== 'string') return null;
  return { type, from, to, name, signal };
}

function asFriendNotice(value: unknown): FriendNotice | null {
  if (!isRecord(value)) return null;
  const { type, friendId, name } = value;
  if ((type !== 'join' && type !== 'leave' && type !== 'syncRequest') || typeof friendId !== 'string' || typeof name !== 'string') return null;
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
  /** Host side: how friends see the episode. */
  mode = $state<WatchMode>('screen');
  /** Friend side: what this PC plays to stay with the host. */
  following = $state<FollowKind>('none');
  /** Friend side: seconds added to the host's position, for a release with a different timing. */
  syncOffsetSeconds = $state(0);
  /** Host side: friends allowed to pause and seek for everyone. */
  controllerIds = $state<string[]>([]);

  /** Host side: the stream's file, which changes with each episode. */
  streamedFile: StreamedFile | null = null;
  private lastSyncPoint: SyncPoint | null = null;
  private ignoreHostUntil = 0;
  private streamHooks: StreamHooks | null = null;
  private room: RelayRoom | null = null;
  private connectionId = '';
  private readonly friendId = crypto.randomUUID();
  private hostConnectionId: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingStates: Promise<void> = Promise.resolve();

  /** This PC's address on the signal channel. */
  get peerId(): string {
    return this.role === 'hosting' ? hostPeerId : this.friendId;
  }

  /** Friend side: the host lets this PC pause and seek for everyone. */
  get canControl(): boolean {
    return this.remote?.controllerIds.includes(this.friendId) ?? false;
  }

  /** Host side: whether a friend may pause and seek for everyone. */
  isController(friendId: string): boolean {
    return this.controllerIds.includes(friendId);
  }

  /** Host side: gives a friend control of playback, or takes it back. */
  setController(friendId: string, isAllowed: boolean): void {
    const others = this.controllerIds.filter((id) => id !== friendId);
    this.controllerIds = isAllowed ? [...others, friendId] : others;
    void this.publishHostState();
  }

  /** Connects the stream store, which depends on this one. */
  connectStream(hooks: StreamHooks): void {
    this.streamHooks = hooks;
  }

  init(): void {
    on('player.started', ({ mediaId, episode }) => {
      this.share({ mediaId, episode, positionSeconds: 0, durationSeconds: 0, isWatched: false });
      if (this.role === 'hosting' && this.mode === 'stream') this.streamHooks?.onHostEpisodeStarted();
    });
    on('player.sync', (point) => this.handleOwnSyncPoint(point));
    on('player.userControl', (control) => this.sendControl(control));
    on('player.progress', (position) => this.share({ ...position, isWatched: this.isSharing(position) && (this.shared?.isWatched ?? false) }));
    on('player.watched', (episode) => {
      if (this.shared && this.isSharing(episode)) this.share({ ...this.shared, isWatched: true });
    });
    on('player.closed', (episode) => {
      if (this.isSharing(episode)) this.share(null);
      if (this.following !== 'none') this.stopFollowingHost();
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

  /** Accepts a Discord invitation: an invitation to another session replaces the current one. */
  async acceptInvite(code: string): Promise<void> {
    if (this.role === 'joined' && this.code === normalizeWatchCode(code)) return;
    if (this.role !== 'idle') await this.leave();
    await this.join(code);
  }

  /** Host side: changes how friends see the episode, for the whole session. */
  setMode(mode: WatchMode): void {
    this.mode = mode;
    if (mode !== 'stream') this.setStream(null);
    if (this.role === 'hosting') void this.publishHostState();
  }

  /** Host side: announces the file friends can stream. */
  setStream(stream: StreamedFile | null): void {
    this.streamedFile = stream;
    if (this.role === 'hosting') void this.publishHostState();
  }

  /** Friend side: opens this PC's copy of the host's episode and follows the host. */
  async followWithOwnFile(): Promise<void> {
    const shared = this.remote?.shared;
    if (!shared || !(await playback.playShared(shared.media, shared.episode))) return;
    this.startFollowing('files');
  }

  /** Friend side: this PC now plays the host's episode, so it asks where the host is. */
  startFollowing(kind: FollowKind): void {
    this.following = kind;
    void this.room?.publish(friendsChannel, this.notice('syncRequest'), false);
  }

  /** Friend side: returns to normal playback; the episode stays open. */
  stopFollowingHost(): void {
    this.following = 'none';
    invoke('player.releaseFromHost').catch((error: unknown) => toasts.error(error, 'Impossible de libérer le lecteur'));
  }

  nudgeSyncOffset(seconds: number): void {
    this.syncOffsetSeconds += seconds;
  }

  sendSignal(message: Omit<StreamSignal, 'from' | 'name'>): void {
    if (!this.room) return;
    const signal: StreamSignal = { ...message, from: this.peerId, name: session.viewer?.name ?? 'Un détective' };
    this.room.publish(signalChannel, signal, false).catch((error: unknown) => toasts.error(error, 'Impossible de joindre l’autre détective'));
  }

  /** Closes the session as host, or leaves it as a friend. */
  async leave(): Promise<void> {
    const room = this.room;
    const role = this.role;
    this.reset();
    this.streamHooks?.onSessionClosed();
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
        channels: role === 'hosting' ? [friendsChannel, signalChannel, controlChannel] : [stateChannel, syncChannel, signalChannel],
        lastWill:
          role === 'hosting'
            ? { channel: stateChannel, payload: this.hostState('lost'), isRetained: true }
            : { channel: friendsChannel, payload: this.notice('leave'), isRetained: false },
        onMessage: (message) => this.routeMessage(role, message),
        onClose: () => this.handleConnectionLost(code, role),
      });
      this.code = code;
      this.role = role;
      this.reconnectAttempt = 0;
      this.isReconnecting = false;
      if (role === 'hosting') await this.publishHostState();
      else await this.room.publish(friendsChannel, this.notice('join'), false);
      this.updateDiscordInvite();
    } finally {
      this.isConnecting = false;
    }
  }

  // <-- L'hôte peut inviter depuis Discord tant que sa séance existe -->
  private updateDiscordInvite(): void {
    const code = this.role === 'hosting' ? this.code : null;
    invoke('discord.setInvite', { code, memberCount: this.friends.length + 1 }).catch((error: unknown) => toasts.error(error, 'Impossible de préparer les invitations Discord'));
  }

  // <-- Coupure réseau : on retente quelques fois avec le même code, la séance n'est pas finie pour autant -->
  private handleConnectionLost(code: string, role: Exclude<GroupWatchRole, 'idle'>): void {
    this.room = null;
    const delay = reconnectDelaysMs[this.reconnectAttempt];
    if (delay === undefined) {
      this.reset();
      this.streamHooks?.onSessionClosed();
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
    if (this.following !== 'none') this.stopFollowingHost();
    this.room = null;
    this.role = 'idle';
    this.code = null;
    this.isReconnecting = false;
    this.reconnectAttempt = 0;
    this.friends = [];
    this.remote = null;
    this.hostConnectionId = null;
    this.mode = 'screen';
    this.streamedFile = null;
    this.syncOffsetSeconds = 0;
    this.controllerIds = [];
    this.ignoreHostUntil = 0;
  }

  private routeMessage(role: Exclude<GroupWatchRole, 'idle'>, message: RelayMessage): void {
    if (message.channel === signalChannel) {
      const signal = asStreamSignal(message.payload);
      if (signal?.to === this.peerId) this.streamHooks?.onSignal(signal);
      return;
    }
    if (message.channel === syncChannel) {
      const point = asSyncMessage(message.payload);
      if (point) this.applySyncPoint(point);
      return;
    }
    if (message.channel === controlChannel) {
      const control = asControlMessage(message.payload);
      if (control) this.applyControl(control);
      return;
    }
    if (role === 'hosting') this.handleFriendNotice(message);
    else this.queueHostState(message);
  }

  // <-- Hôte : chaque point part aux amis ; la position sert aussi de borne à ce que le flux peut envoyer -->
  private handleOwnSyncPoint(point: SyncPoint): void {
    this.lastSyncPoint = point;
    if (this.shared && this.isSharing(point)) {
      this.shared = { ...this.shared, positionSeconds: point.positionSeconds, durationSeconds: point.durationSeconds };
    }
    this.publishSyncPoint();
  }

  private publishSyncPoint(): void {
    const point = this.lastSyncPoint;
    if (this.role !== 'hosting' || this.mode === 'screen' || !this.friends.length || !point) return;
    const message: SyncMessage = { ...point, sentAt: Date.now() };
    this.room?.publish(syncChannel, message, false).catch((error: unknown) => toasts.error(error, 'Impossible de synchroniser la séance'));
  }

  private sendControl({ mediaId, episode, positionSeconds, isPaused }: BridgeEvents['player.userControl']): void {
    if (this.role !== 'joined' || this.following === 'none' || !this.canControl) return;
    this.ignoreHostUntil = Date.now() + controlGraceMs;
    const hostPosition = positionSeconds === null ? null : Math.max(0, positionSeconds - this.syncOffsetSeconds);
    const message: ControlMessage = { friendId: this.friendId, mediaId, episode, positionSeconds: hostPosition, isPaused };
    this.room?.publish(controlChannel, message, false).catch((error: unknown) => toasts.error(error, 'Impossible de piloter la séance'));
  }

  // <-- Hôte : l'action d'un ami autorisé s'applique ici, puis repart vers tout le monde comme un point de synchro -->
  private applyControl({ friendId, mediaId, episode, positionSeconds, isPaused }: ControlMessage): void {
    if (this.role !== 'hosting' || this.mode === 'screen' || !this.isController(friendId)) return;
    if (!this.shared || !this.isSharing({ mediaId, episode })) return;
    if (isPaused !== null) {
      const name = this.friends.find((friend) => friend.friendId === friendId)?.name ?? 'Un ami';
      toasts.show(isPaused ? `${name} a mis en pause.` : `${name} a relancé l’épisode.`, 'info');
    }
    invoke('player.applyControl', { positionSeconds, isPaused }).catch((error: unknown) => toasts.error(error, 'Impossible d’appliquer l’action de ton ami'));
  }

  // <-- Ami : le message a voyagé, donc l'hôte a déjà avancé d'autant s'il n'est pas en pause -->
  private applySyncPoint(point: SyncMessage): void {
    const current = playback.nowPlaying;
    if (this.following === 'none' || !current || current.isRemote || Date.now() < this.ignoreHostUntil) return;
    if (current.media.id !== point.mediaId || current.episode !== point.episode) return;
    const lagSeconds = point.isPaused ? 0 : Math.min(maxSyncLagSeconds, Math.max(0, (Date.now() - point.sentAt) / 1000));
    const positionSeconds = Math.max(0, point.positionSeconds + lagSeconds + this.syncOffsetSeconds);
    invoke('player.followHost', { positionSeconds, isPaused: point.isPaused }).catch((error: unknown) => toasts.error(error, 'Impossible de suivre l’hôte'));
  }

  private isSharing(episode: { mediaId: number; episode: number }): boolean {
    return this.shared?.mediaId === episode.mediaId && this.shared.episode === episode.episode;
  }

  private share(shared: SharedEpisode | null): void {
    this.shared = shared;
    if (this.role === 'hosting') void this.publishHostState();
  }

  private hostState(status: HostState['status']): HostState {
    return {
      status,
      hostName: session.viewer?.name ?? 'Un détective',
      connectionId: this.connectionId,
      shared: this.shared,
      mode: this.mode,
      stream: this.streamedFile,
      controllerIds: this.controllerIds,
    };
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
    if (notice.type === 'syncRequest') {
      this.publishSyncPoint();
      return;
    }
    const others = this.friends.filter((friend) => friend.friendId !== notice.friendId);
    const isNew = others.length === this.friends.length;
    if (notice.type === 'leave') {
      if (!isNew) toasts.show(`${notice.name} a quitté la séance.`, 'info');
      this.friends = others;
      this.updateDiscordInvite();
      if (this.isController(notice.friendId)) this.setController(notice.friendId, false);
      return;
    }
    if (isNew) toasts.show(`${notice.name} a rejoint la séance !`, 'info');
    this.friends = [...others, { friendId: notice.friendId, name: notice.name }];
    this.updateDiscordInvite();
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
      this.remote = { hostName: state.hostName, status: state.status, shared: null, mode: state.mode, stream: state.stream, controllerIds: state.controllerIds };
      this.stopFollowing();
      return;
    }

    const shared = state.shared;
    const media = previous?.mediaId === shared.mediaId ? previous.media : await mediaFor(shared.mediaId);
    if (this.role !== 'joined') return;
    this.remote = { hostName: state.hostName, status: state.status, shared: { ...shared, media }, mode: state.mode, stream: state.stream, controllerIds: state.controllerIds };
    await this.followNextEpisode(previous, media);
    if (!playback.followRemote(media, shared.episode)) return;
    liveAbout.trackPosition({ mediaId: shared.mediaId, episode: shared.episode, positionSeconds: shared.positionSeconds, durationSeconds: shared.durationSeconds });

    // <-- Seul un passage à « vu » observé en direct compte : arriver après coup ne coche pas l'épisode -->
    const isSameEpisode = previous?.mediaId === shared.mediaId && previous.episode === shared.episode;
    if (shared.isWatched && !isRetained && isSameEpisode && !previous.isWatched) playback.recordRemoteWatched();
  }

  // <-- L'hôte change d'épisode : ce PC suit tout seul avec son fichier ; le flux, lui, suit son propre fichier -->
  private async followNextEpisode(previous: RemoteSession['shared'] | undefined, media: MediaSummary): Promise<void> {
    const shared = this.remote?.shared;
    if (!shared) return;
    const hasEpisodeChanged = previous && (previous.mediaId !== shared.mediaId || previous.episode !== shared.episode);
    this.streamHooks?.onRemoteChanged();
    if (this.following !== 'files' || !hasEpisodeChanged) return;
    if (!playback.hasEpisodeFile(shared.mediaId, shared.episode)) {
      toasts.show(`L’épisode ${shared.episode} n’est pas dans ton dossier : tu restes sur le précédent.`, 'info');
      this.stopFollowingHost();
      return;
    }
    if (await playback.playShared(media, shared.episode)) this.startFollowing('files');
  }

  private stopFollowing(): void {
    if (!playback.nowPlaying?.isRemote) return;
    playback.stopFollowingRemote();
    liveAbout.trackPosition(null);
  }
}

/** What the stream store reacts to; it imports this store, so this store only calls back. */
interface StreamHooks {
  onSignal: (signal: StreamSignal) => void;
  onHostEpisodeStarted: () => void;
  onRemoteChanged: () => void;
  onSessionClosed: () => void;
}

async function mediaFor(mediaId: number): Promise<MediaSummary> {
  const known = mediaList.entryFor(mediaId)?.media;
  if (known) return known;
  const [media] = await fetchMediaSummaries([mediaId]);
  if (!media) throw new Error('Cet anime est introuvable sur AniList.');
  return media;
}

export const groupWatch = new GroupWatch();
