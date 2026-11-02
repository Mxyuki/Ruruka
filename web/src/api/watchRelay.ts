// <-- Relais public MQTT sur WebSocket sécurisé : personne n'ouvre de port, chacun se connecte en sortie -->
const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
// <-- Fenêtre cachée dans la barre des tâches, Chromium espace les minuteurs jusqu'à une minute : 2 minutes de keep-alive tiennent le coup -->
const keepAliveSeconds = 120;
const pingIntervalMs = 50_000;
const topicRoot = 'ruruka/watch/v1';

const packetConnect = 0x10;
const packetConnAck = 0x20;
const packetPublish = 0x30;
const packetSubscribe = 0x82;
const packetPingReq = 0xc0;
const packetDisconnect = 0xe0;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface RelayMessage {
  channel: string;
  payload: unknown;
  /** The broker kept this message for late subscribers; it describes the past, not a live change. */
  isRetained: boolean;
}

export interface RelayOptions {
  code: string;
  channels: string[];
  /** Sent by the broker, retained or not, once the connection drops without a goodbye. */
  lastWill: { channel: string; payload: unknown; isRetained: boolean };
  onMessage: (message: RelayMessage) => void;
  onClose: () => void;
}

/** A sealed pub/sub room on the public relay; messages are encrypted and authenticated with the room code. */
export interface RelayRoom {
  publish(channel: string, payload: unknown, isRetained: boolean): Promise<void>;
  /** Leaves without triggering the last will. */
  close(): void;
}

interface RoomKeys {
  topic: string;
  key: CryptoKey;
}

// <-- Le sujet est un hachage du code et la clé en dérive : le relais public ne voit ni le code ni le contenu -->
async function deriveRoomKeys(code: string): Promise<RoomKeys> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(code), 'HKDF', false, ['deriveBits', 'deriveKey']);
  const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(topicRoot), info: encoder.encode(info) });
  const topicBits = await crypto.subtle.deriveBits(hkdf('topic'), material, 128);
  const key = await crypto.subtle.deriveKey(hkdf('key'), material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const topic = [...new Uint8Array(topicBits)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return { topic: `${topicRoot}/${topic}`, key };
}

async function seal(key: CryptoKey, payload: unknown): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(payload))));
  return concat(iv, cipher);
}

// <-- Un message qu'on ne sait pas ouvrir vient d'ailleurs que de la séance : on l'ignore -->
async function open(key: CryptoKey, sealed: Uint8Array): Promise<unknown> {
  if (sealed.length < 13) return undefined;
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(0, 12) }, key, sealed.slice(12));
    return JSON.parse(decoder.decode(plain)) as unknown;
  } catch {
    return undefined;
  }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function utf8Field(text: string): Uint8Array {
  return binaryField(encoder.encode(text));
}

function binaryField(bytes: Uint8Array): Uint8Array {
  return concat(new Uint8Array([bytes.length >> 8, bytes.length & 0xff]), bytes);
}

function remainingLength(size: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let byte = size % 128;
    size = Math.floor(size / 128);
    if (size > 0) byte |= 0x80;
    bytes.push(byte);
  } while (size > 0);
  return new Uint8Array(bytes);
}

function packet(header: number, ...body: Uint8Array[]): Uint8Array {
  const content = concat(...body);
  return concat(new Uint8Array([header]), remainingLength(content.length), content);
}

function connectPacket(clientId: string, willTopic: string, willMessage: Uint8Array, isWillRetained: boolean): Uint8Array {
  const cleanSession = 0x02;
  const willFlag = 0x04;
  const willRetain = isWillRetained ? 0x20 : 0;
  return packet(
    packetConnect,
    utf8Field('MQTT'),
    new Uint8Array([4, cleanSession | willFlag | willRetain, keepAliveSeconds >> 8, keepAliveSeconds & 0xff]),
    utf8Field(clientId),
    utf8Field(willTopic),
    binaryField(willMessage),
  );
}

const publishPacket = (topic: string, message: Uint8Array, isRetained: boolean) =>
  packet(packetPublish | (isRetained ? 0x01 : 0), utf8Field(topic), message);

const subscribePacket = (packetId: number, topic: string) =>
  packet(packetSubscribe, new Uint8Array([packetId >> 8, packetId & 0xff]), utf8Field(topic), new Uint8Array([0]));

interface IncomingPublish {
  topic: string;
  message: Uint8Array;
  isRetained: boolean;
}

/** Splits a WebSocket frame into MQTT packets (a frame may carry several) and keeps the PUBLISH ones. */
function readPublishes(frame: Uint8Array): IncomingPublish[] {
  const publishes: IncomingPublish[] = [];
  let offset = 0;
  while (offset < frame.length) {
    const header = frame[offset] ?? 0;
    let size = 0;
    let multiplier = 1;
    let cursor = offset + 1;
    let byte: number;
    do {
      byte = frame[cursor++] ?? 0;
      size += (byte & 0x7f) * multiplier;
      multiplier *= 128;
    } while (byte & 0x80);
    const body = frame.subarray(cursor, cursor + size);
    offset = cursor + size;
    if ((header & 0xf0) !== packetPublish) continue;
    const topicLength = ((body[0] ?? 0) << 8) | (body[1] ?? 0);
    const hasPacketId = (header & 0x06) !== 0;
    const messageStart = 2 + topicLength + (hasPacketId ? 2 : 0);
    publishes.push({
      topic: decoder.decode(body.subarray(2, 2 + topicLength)),
      message: body.slice(messageStart),
      isRetained: (header & 0x01) !== 0,
    });
  }
  return publishes;
}

const isConnAckAccepted = (frame: Uint8Array) => frame[0] === packetConnAck && frame[3] === 0;

/** Joins the room for `code` on the public relay. Resolves once the broker accepted the connection. */
export async function joinRelayRoom(options: RelayOptions): Promise<RelayRoom> {
  const { topic, key } = await deriveRoomKeys(options.code);
  const willMessage = await seal(key, options.lastWill.payload);
  const clientId = `ruruka-${crypto.randomUUID().slice(0, 18)}`;
  const socket = new WebSocket(brokerUrl, 'mqtt');
  socket.binaryType = 'arraybuffer';

  let isConnected = false;
  let isClosedByUs = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  const send = (bytes: Uint8Array) => socket.readyState === WebSocket.OPEN && socket.send(bytes);

  const room: RelayRoom = {
    async publish(channel, payload, isRetained) {
      send(publishPacket(`${topic}/${channel}`, await seal(key, payload), isRetained));
    },
    close() {
      isClosedByUs = true;
      send(new Uint8Array([packetDisconnect, 0]));
      socket.close();
    },
  };

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      send(connectPacket(clientId, `${topic}/${options.lastWill.channel}`, willMessage, options.lastWill.isRetained));
    });

    socket.addEventListener('message', ({ data }) => {
      if (!(data instanceof ArrayBuffer)) return;
      const frame = new Uint8Array(data);
      if (!isConnected) {
        if (!isConnAckAccepted(frame)) {
          socket.close();
          reject(new Error('Le relais a refusé la connexion.'));
          return;
        }
        isConnected = true;
        options.channels.forEach((channel, index) => send(subscribePacket(index + 1, `${topic}/${channel}`)));
        // <-- MQTT exige un signe de vie avant la fin du keep-alive, sinon le relais coupe et envoie le testament -->
        pingTimer = setInterval(() => send(new Uint8Array([packetPingReq, 0])), pingIntervalMs);
        resolve(room);
        return;
      }
      for (const publish of readPublishes(frame)) {
        const channel = publish.topic.slice(topic.length + 1);
        void open(key, publish.message).then((payload) => {
          if (payload !== undefined) options.onMessage({ channel, payload, isRetained: publish.isRetained });
        });
      }
    });

    socket.addEventListener('close', () => {
      if (pingTimer) clearInterval(pingTimer);
      if (!isConnected) {
        reject(new Error('Impossible de joindre le relais des séances.'));
        return;
      }
      if (!isClosedByUs) options.onClose();
    });
  });
}
