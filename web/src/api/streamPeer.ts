// <-- Connexion directe entre deux Ruruka : aucun port ouvert, et WebRTC chiffre tout de bout en bout -->
const iceServers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const channelLabel = 'stream';
/** Chromium accepts 256 KB messages, but shorter ones let requests from two readers share the channel. */
const frameBytes = 64 * 1024;
const frameHeaderBytes = 5;
const maxBufferedBytes = 1024 * 1024;
const lastFrameFlag = 1;

/** Offers, answers and network candidates, carried by the sealed relay until the direct link exists. */
export type PeerSignal = { kind: 'description'; description: RTCSessionDescriptionInit } | { kind: 'candidate'; candidate: RTCIceCandidateInit };

export interface ChunkRequest {
  requestId: number;
  fileKey: string;
  offset: number;
  length: number;
}

interface ChunkFailure {
  requestId: number;
  isRefused: true;
}

export interface PeerLink {
  handleSignal(signal: PeerSignal): void;
  close(): void;
}

export interface ViewerLink extends PeerLink {
  /** Rejects when the host refuses or the link drops. */
  request(fileKey: string, offset: number, length: number): Promise<ArrayBuffer>;
}

interface LinkOptions {
  onSignal: (signal: PeerSignal) => void;
  onConnected: () => void;
  onClosed: () => void;
}

interface HostLinkOptions extends LinkOptions {
  /** Returns the bytes, or null to refuse the request. */
  readChunk: (request: ChunkRequest) => Promise<ArrayBuffer | null>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function asChunkRequest(value: unknown): ChunkRequest | null {
  if (!isRecord(value)) return null;
  const { requestId, fileKey, offset, length } = value;
  if (typeof requestId !== 'number' || typeof fileKey !== 'string' || typeof offset !== 'number' || typeof length !== 'number') return null;
  return { requestId, fileKey, offset, length };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** A signal from the relay is only used after this check, since anyone holding the code can post one. */
export function asPeerSignal(value: unknown): PeerSignal | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'description' && isRecord(value.description)) {
    const { type, sdp } = value.description;
    if ((type === 'offer' || type === 'answer') && typeof sdp === 'string') return { kind: 'description', description: { type, sdp } };
  }
  if (value.kind === 'candidate' && isRecord(value.candidate)) return { kind: 'candidate', candidate: value.candidate };
  return null;
}

/** Shared by both ends: signals run one at a time, and early candidates wait for the remote description. */
function createConnection({ onSignal, onConnected, onClosed }: LinkOptions) {
  const connection = new RTCPeerConnection({ iceServers });
  const earlyCandidates: RTCIceCandidateInit[] = [];
  let pendingSignals: Promise<void> = Promise.resolve();
  let isClosed = false;

  const close = () => {
    if (isClosed) return;
    isClosed = true;
    connection.close();
    onClosed();
  };

  connection.addEventListener('icecandidate', ({ candidate }) => {
    if (candidate) onSignal({ kind: 'candidate', candidate: candidate.toJSON() });
  });
  // <-- « disconnected » peut se rétablir seul : seul « failed » met fin au lien -->
  connection.addEventListener('connectionstatechange', () => {
    if (connection.connectionState === 'connected') onConnected();
    if (connection.connectionState === 'failed') close();
  });

  async function applySignal(signal: PeerSignal): Promise<void> {
    if (signal.kind === 'candidate') {
      if (connection.remoteDescription) await connection.addIceCandidate(signal.candidate);
      else earlyCandidates.push(signal.candidate);
      return;
    }
    await connection.setRemoteDescription(signal.description);
    for (const candidate of earlyCandidates.splice(0)) await connection.addIceCandidate(candidate);
    if (signal.description.type !== 'offer') return;
    await connection.setLocalDescription();
    if (connection.localDescription) onSignal({ kind: 'description', description: connection.localDescription.toJSON() });
  }

  const handleSignal = (signal: PeerSignal) => {
    pendingSignals = pendingSignals.then(() => applySignal(signal)).catch(close);
  };

  return { connection, handleSignal, close };
}

function waitForRoom(channel: RTCDataChannel): Promise<void> {
  if (channel.bufferedAmount <= maxBufferedBytes) return Promise.resolve();
  return new Promise((resolve) => {
    channel.addEventListener('bufferedamountlow', () => resolve(), { once: true });
  });
}

function writeFrameHeader(frame: Uint8Array, requestId: number, isLast: boolean): void {
  const header = new DataView(frame.buffer, frame.byteOffset, frameHeaderBytes);
  header.setUint32(0, requestId);
  header.setUint8(4, isLast ? lastFrameFlag : 0);
}

async function sendChunk(channel: RTCDataChannel, requestId: number, bytes: Uint8Array): Promise<void> {
  let offset = 0;
  do {
    const part = bytes.subarray(offset, offset + frameBytes);
    offset += part.length;
    const frame = new Uint8Array(frameHeaderBytes + part.length);
    writeFrameHeader(frame, requestId, offset >= bytes.length);
    frame.set(part, frameHeaderBytes);
    await waitForRoom(channel);
    channel.send(frame);
  } while (offset < bytes.length);
}

/** The host's end for one friend: answers its offer, then serves the chunks it asks for. */
export function openHostLink(options: HostLinkOptions): PeerLink {
  const { connection, handleSignal, close } = createConnection(options);

  async function serve(channel: RTCDataChannel, request: ChunkRequest): Promise<void> {
    const bytes = await options.readChunk(request).catch(() => null);
    if (channel.readyState !== 'open') return;
    if (!bytes) {
      const failure: ChunkFailure = { requestId: request.requestId, isRefused: true };
      channel.send(JSON.stringify(failure));
      return;
    }
    await sendChunk(channel, request.requestId, new Uint8Array(bytes));
  }

  connection.addEventListener('datachannel', ({ channel }) => {
    if (channel.label !== channelLabel) return;
    channel.bufferedAmountLowThreshold = maxBufferedBytes / 2;
    channel.addEventListener('message', ({ data }) => {
      const request = typeof data === 'string' ? asChunkRequest(parseJson(data)) : null;
      if (request) void serve(channel, request).catch(close);
    });
    channel.addEventListener('close', close);
  });
  return { handleSignal, close };
}

interface PendingChunk {
  parts: Uint8Array[];
  resolve: (bytes: ArrayBuffer) => void;
  reject: (error: Error) => void;
}

function joinParts(parts: Uint8Array[]): ArrayBuffer {
  const joined = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined.buffer;
}

/** The friend's end: creates the offer, then asks the host for chunks. */
export function openViewerLink(options: LinkOptions): ViewerLink {
  const pending = new Map<number, PendingChunk>();
  let nextRequestId = 1;

  const rejectAll = () => {
    for (const chunk of pending.values()) chunk.reject(new Error('Le lien avec l’hôte est coupé.'));
    pending.clear();
  };

  const { connection, handleSignal, close } = createConnection({
    ...options,
    onClosed: () => {
      rejectAll();
      options.onClosed();
    },
  });

  const channel = connection.createDataChannel(channelLabel, { ordered: true });
  channel.binaryType = 'arraybuffer';
  channel.addEventListener('close', close);
  channel.addEventListener('message', ({ data }) => {
    if (typeof data === 'string') {
      const failure = parseJson(data);
      if (!isRecord(failure) || typeof failure.requestId !== 'number') return;
      pending.get(failure.requestId)?.reject(new Error('L’hôte a refusé ce passage de l’épisode.'));
      pending.delete(failure.requestId);
      return;
    }
    if (!(data instanceof ArrayBuffer) || data.byteLength < frameHeaderBytes) return;
    const header = new DataView(data, 0, frameHeaderBytes);
    const requestId = header.getUint32(0);
    const chunk = pending.get(requestId);
    if (!chunk) return;
    chunk.parts.push(new Uint8Array(data, frameHeaderBytes));
    if ((header.getUint8(4) & lastFrameFlag) === 0) return;
    pending.delete(requestId);
    chunk.resolve(joinParts(chunk.parts));
  });

  void connection
    .setLocalDescription()
    .then(() => {
      if (connection.localDescription) options.onSignal({ kind: 'description', description: connection.localDescription.toJSON() });
    })
    .catch(close);

  return {
    handleSignal,
    close,
    request(fileKey, offset, length) {
      if (channel.readyState !== 'open') return Promise.reject(new Error('Le lien avec l’hôte n’est pas ouvert.'));
      const requestId = nextRequestId++;
      const message: ChunkRequest = { requestId, fileKey, offset, length };
      return new Promise((resolve, reject) => {
        pending.set(requestId, { parts: [], resolve, reject });
        channel.send(JSON.stringify(message));
      });
    },
  };
}
