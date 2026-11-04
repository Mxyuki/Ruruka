import { asPeerSignal, openHostLink, openViewerLink, type ChunkRequest, type PeerLink, type ViewerLink } from '../api/streamPeer';
import { deliverStreamChunk, invoke, on, readSharedChunk } from '../lib/bridge';
import { isRangeAllowed } from '../lib/streamWindow';
import { groupWatch, hostPeerId, type StreamSignal } from './groupWatch.svelte';
import { playback } from './playback.svelte';
import { toasts } from './toasts.svelte';

export type ViewerStatus = 'waiting' | 'connecting' | 'connected';

/** Host side: a friend asking for the stream, or receiving it. */
export interface StreamViewer {
  friendId: string;
  name: string;
  status: ViewerStatus;
}

/** Friend side: where this PC stands with the host's stream. */
export type StreamLinkStatus = 'idle' | ViewerStatus;

/**
 * The stream of a group watch. The host validates each friend, then a direct WebRTC link carries
 * the file bytes the friend's player reads. The relay only carries the setup, sealed with the code.
 */
class WatchStream {
  /** Host side: the friends asking for the stream or receiving it. */
  viewers = $state<StreamViewer[]>([]);
  /** Friend side. */
  linkStatus = $state<StreamLinkStatus>('idle');

  private hostLinks = new Map<string, PeerLink>();
  private viewerLink: ViewerLink | null = null;
  private fileKey: string | null = null;
  private hasReportedChunkFailure = false;

  init(): void {
    groupWatch.connectStream({
      onSignal: (signal) => this.handleSignal(signal),
      onHostEpisodeStarted: () => void this.shareCurrentFile(),
      onRemoteChanged: () => void this.playRemoteFile(),
      onSessionClosed: () => this.stopAll(),
    });
    on('stream.chunkNeeded', (request) => void this.fetchChunk(request));
    on('player.closed', () => {
      if (this.linkStatus === 'connected') this.leaveStream();
    });
  }

  /** Host side: switches the session to the stream, starting with the episode playing now. */
  async startSharing(): Promise<void> {
    groupWatch.setMode('stream');
    await this.shareCurrentFile();
  }

  /** Host side: returns to another mode and cuts every friend off the stream. */
  stopSharing(): void {
    for (const friendId of this.hostLinks.keys()) this.dropViewer(friendId);
    this.viewers = [];
    this.fileKey = null;
    invoke('stream.stopSharing').catch((error: unknown) => toasts.error(error, 'Impossible d’arrêter le partage'));
  }

  /** Host side: lets a waiting friend in. */
  admit(friendId: string): void {
    this.setViewerStatus(friendId, 'connecting');
    const link = openHostLink({
      onSignal: (signal) => groupWatch.sendSignal({ type: 'peer', to: friendId, signal }),
      onConnected: () => this.setViewerStatus(friendId, 'connected'),
      onClosed: () => this.forgetViewer(friendId),
      readChunk: (request) => this.readChunk(friendId, request),
    });
    this.hostLinks.set(friendId, link);
    groupWatch.sendSignal({ type: 'admit', to: friendId, signal: null });
  }

  /** Host side: refuses a waiting friend, or cuts off a connected one. */
  dropViewer(friendId: string): void {
    groupWatch.sendSignal({ type: 'refuse', to: friendId, signal: null });
    this.hostLinks.get(friendId)?.close();
    this.forgetViewer(friendId);
  }

  /** Friend side: asks the host for the stream. */
  requestStream(): void {
    this.linkStatus = 'waiting';
    groupWatch.sendSignal({ type: 'request', to: hostPeerId, signal: null });
  }

  /** Friend side: leaves the stream; the host's episode goes on. */
  leaveStream(): void {
    const link = this.viewerLink;
    this.viewerLink = null;
    this.linkStatus = 'idle';
    this.fileKey = null;
    link?.close();
    groupWatch.stopFollowingHost();
    invoke('stream.closeViewer').catch((error: unknown) => toasts.error(error, 'Impossible de fermer le flux'));
  }

  private handleSignal(message: StreamSignal): void {
    switch (message.type) {
      case 'request':
        this.handleViewerRequest(message);
        break;
      case 'admit':
        this.connectToHost();
        break;
      case 'refuse':
        this.handleRefusal();
        break;
      case 'peer':
        this.handlePeerSignal(message);
        break;
    }
  }

  private handleViewerRequest({ from, name }: StreamSignal): void {
    if (groupWatch.role !== 'hosting' || groupWatch.mode !== 'stream') return;
    if (this.viewers.some((viewer) => viewer.friendId === from)) return;
    this.viewers = [...this.viewers, { friendId: from, name, status: 'waiting' }];
    toasts.show(`${name} demande à voir le flux.`, 'info');
  }

  private handleRefusal(): void {
    if (this.linkStatus === 'idle') return;
    toasts.show('L’hôte n’a pas ouvert le flux pour toi.', 'info');
    this.leaveStream();
  }

  private handlePeerSignal(message: StreamSignal): void {
    const signal = asPeerSignal(message.signal);
    if (!signal) return;
    const link = groupWatch.role === 'hosting' ? this.hostLinks.get(message.from) : this.viewerLink;
    link?.handleSignal(signal);
  }

  private connectToHost(): void {
    if (this.linkStatus !== 'waiting') return;
    this.linkStatus = 'connecting';
    this.hasReportedChunkFailure = false;
    this.viewerLink = openViewerLink({
      onSignal: (signal) => groupWatch.sendSignal({ type: 'peer', to: hostPeerId, signal }),
      onConnected: () => void this.handleConnected(),
      onClosed: () => this.handleLinkLost(),
    });
  }

  private async handleConnected(): Promise<void> {
    this.linkStatus = 'connected';
    await this.playRemoteFile();
  }

  // <-- Ni la box de l'hôte ni celle de l'ami ne laissent passer la connexion directe, ou le lien vient de tomber -->
  private handleLinkLost(): void {
    if (this.linkStatus === 'idle') return;
    const wasConnected = this.linkStatus === 'connected';
    this.viewerLink = null;
    this.leaveStream();
    toasts.error(
      wasConnected
        ? 'Le lien direct avec l’hôte est coupé.'
        : 'Vos connexions refusent le lien direct : passez par le partage d’écran, ou essaie depuis un autre réseau.',
    );
  }

  private async playRemoteFile(): Promise<void> {
    const remote = groupWatch.remote;
    if (this.linkStatus !== 'connected' || !remote?.shared || !remote.stream) return;
    if (remote.stream.fileKey === this.fileKey) return;
    const { fileKey, fileSize, extension } = remote.stream;
    this.fileKey = fileKey;
    const isPlaying = await playback.playStream(remote.shared.media, remote.shared.episode, { fileSize, extension });
    if (isPlaying) groupWatch.startFollowing('stream');
  }

  // <-- Ami : mpv lit des octets, on les demande à l'hôte et on les redonne au programme -->
  private async fetchChunk({ requestId, offset, length }: { requestId: string; offset: number; length: number }): Promise<void> {
    const link = this.viewerLink;
    const fileKey = groupWatch.remote?.stream?.fileKey;
    try {
      if (!link || !fileKey) throw new Error('Aucun flux en cours.');
      await deliverStreamChunk(requestId, await link.request(fileKey, offset, length));
    } catch (error) {
      await deliverStreamChunk(requestId, new ArrayBuffer(0)).catch(() => undefined);
      if (!this.hasReportedChunkFailure) toasts.error(error, 'Le flux s’est interrompu');
      this.hasReportedChunkFailure = true;
    }
  }

  // <-- Hôte : seuls le fichier du moment et les passages proches de la lecture partent chez l'ami -->
  // Un ami autorisé à piloter saute avant que l'hôte n'ait bougé : la limite le couperait au milieu de son geste.
  private async readChunk(friendId: string, { fileKey, offset, length }: ChunkRequest): Promise<ArrayBuffer | null> {
    const shared = groupWatch.shared;
    const file = groupWatch.streamedFile;
    if (!shared || !file || fileKey !== file.fileKey) return null;
    const isAllowed = groupWatch.isController(friendId) || isRangeAllowed(offset, length, file.fileSize, shared);
    return isAllowed ? readSharedChunk(offset, length) : null;
  }

  private async shareCurrentFile(): Promise<void> {
    if (!groupWatch.shared) return;
    try {
      const file = await invoke('stream.share');
      this.fileKey = crypto.randomUUID();
      groupWatch.setStream({ ...file, fileKey: this.fileKey });
    } catch (error) {
      toasts.error(error, 'Impossible de partager cet épisode');
    }
  }

  private setViewerStatus(friendId: string, status: ViewerStatus): void {
    this.viewers = this.viewers.map((viewer) => (viewer.friendId === friendId ? { ...viewer, status } : viewer));
  }

  private forgetViewer(friendId: string): void {
    this.hostLinks.delete(friendId);
    this.viewers = this.viewers.filter((viewer) => viewer.friendId !== friendId);
  }

  private stopAll(): void {
    if (this.hostLinks.size || this.fileKey) this.stopSharing();
    if (this.linkStatus !== 'idle') this.leaveStream();
  }
}

export const watchStream = new WatchStream();
