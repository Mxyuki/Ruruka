/** "system" follows the Windows app mode (light or dark); "schedule" switches at two times of day. */
export type Theme = 'light' | 'dark' | 'system' | 'schedule';

/** Covers in the calendar's day cells; "single" keeps them for days with one anime airing. */
export type CalendarCovers = 'all' | 'single' | 'none';

export interface Settings {
  aniListClientId: string | null;
  isLoggedIn: boolean;
  playerPath: string | null;
  /** The bundled Ruruka player, or the user's own mpv with their config. */
  playerKind: PlayerKind;
  libraryRoot: string | null;
  isSetupComplete: boolean;
  hasSkipWarning: boolean;
  /** UI zoom; 0 means automatic from the window size. */
  interfaceScale: number;
  /** The close button hides the window to the notification area instead of quitting. */
  isCloseToTray: boolean;
  /** Windows starts Ruruka at sign-in, hidden in the notification area. */
  isLaunchedAtStartup: boolean;
  /** mpv stays open on the last frame of an episode, so the next one plays in the same window. */
  isPlayerKeptOpen: boolean;
  /** The Ruruka player shows the anime, episode and time on the Discord profile. */
  isDiscordPresenceShown: boolean;
  /** How far into an episode (in %) playback must reach before it counts as watched. */
  episodeCompletionPercent: number;
  /** The share of an episode (in %) that must really be played; the rest may be skipped. */
  minimumWatchedPercent: number;
  /** Minutes both lists of a comparison stay in memory; 0 reloads them on every visit. */
  compareCacheMinutes: number;
  calendarCovers: CalendarCovers;
  /** The about with live tags, kept on this PC only; empty when the about is plain text. */
  aboutTemplate: string;
  /** Media page section ids in the user's order; empty keeps the default order. */
  mediaSectionOrder: string[];
  /** Chapter translation language, such as "fr" or "pt-br". */
  mangaLanguage: string;
  theme: Theme;
  /** With the "schedule" theme, minute of the day the light notebook starts (540 = 9:00). */
  themeLightFromMinute: number;
  /** With the "schedule" theme, minute of the day the night notebook starts. */
  themeDarkFromMinute: number;
  /** Search site typed by the user ("monsite.org"); empty hides every search button. */
  searchSiteUrl: string;
  /** Manga site whose API lists and serves chapters; empty hides chapter reading. */
  mangaSiteUrl: string;
  /** Server hosting the anime song files named by AnisongDB; empty hides the players. */
  songFileHostUrl: string;
}

export type PlayerKind = 'ruruka' | 'mpv';

export type SettingsPatch = Partial<Omit<Settings, 'isLoggedIn'>>;

export interface EpisodeFile {
  path: string;
  fileName: string;
  number: number | null;
}

export interface LibraryFolder {
  name: string;
  path: string;
  guessedTitle: string;
  episodes: EpisodeFile[];
}

export type LinkKind = 'auto' | 'manual' | 'unmatched';

export interface FolderLink {
  mediaId: number | null;
  kind: LinkKind;
  episodeOffset: number;
}

export interface PlayerStatus {
  mpvPath: string | null;
  isInstalled: boolean;
  /** Installs without the bundled player have to use their own mpv. */
  isBundledPlayerAvailable: boolean;
}

export interface PlaybackTarget {
  mediaId: number;
  episode: number;
  filePath: string;
  title: string;
  /** AniList cover shown on Discord. */
  coverUrl: string;
}

export interface SharedFile {
  fileSize: number;
  extension: string;
}

/** An anime attached to an event; `episodesPerSession` 0 attaches it without an episode goal. */
export interface CalendarEventAnime {
  mediaId: number;
  title: string;
  coverUrl: string;
  totalEpisodes: number | null;
  firstEpisode: number;
  episodesPerSession: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** First day, as "yyyy-mm-dd". */
  date: string;
  /** "hh:mm", or null for the whole day. */
  time: string | null;
  notes: string;
  /** How many weeks in a row it happens, the first one included. */
  repeatWeeks: number;
  anime: CalendarEventAnime | null;
}

export interface CalendarData {
  hiddenMediaIds: number[];
  events: CalendarEvent[];
}

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notesUrl: string;
}

/** Every host method: `[params, result]`. Registered in src/Ruruka.Desktop/Bridge/Modules. */
interface BridgeApi {
  'settings.get': [void, Settings];
  'settings.update': [SettingsPatch, Settings];
  'auth.login': [void, boolean];
  'auth.setToken': [{ token: string }, boolean];
  'auth.getToken': [void, string | null];
  'auth.logout': [void, boolean];
  'library.scan': [void, LibraryFolder[]];
  'library.getLinks': [void, Record<string, FolderLink>];
  'library.setLink': [{ folderName: string; link: FolderLink }, boolean];
  'library.removeLink': [{ folderName: string }, boolean];
  'calendar.get': [void, CalendarData];
  /** Adds the event, or replaces the one with the same id. */
  'calendar.saveEvent': [CalendarEvent, boolean];
  'calendar.removeEvent': [{ id: string }, boolean];
  'calendar.hideMedia': [{ mediaId: number }, boolean];
  'calendar.showMedia': [{ mediaIds: number[] }, boolean];
  'player.detect': [void, PlayerStatus];
  'player.setPath': [{ path: string }, boolean];
  'player.play': [PlaybackTarget, boolean];
  /** Moves this PC's player toward the host's position during a synced session. */
  'player.followHost': [{ positionSeconds: number; isPaused: boolean }, boolean];
  'player.releaseFromHost': [void, boolean];
  /** Host side: applies the pause or seek of a friend allowed to control playback. */
  'player.applyControl': [{ positionSeconds: number | null; isPaused: boolean | null }, boolean];
  /** Host side: shares the file its player opened; a friend can never name a path. */
  'stream.share': [void, SharedFile];
  'stream.stopSharing': [void, boolean];
  /** Friend side: opens the local address fed by the UI and plays it. */
  'stream.play': [{ mediaId: number; episode: number; title: string; coverUrl: string; fileSize: number; extension: string }, boolean];
  'stream.closeViewer': [void, boolean];
  'shell.openUrl': [{ url: string }, boolean];
  'shell.openPath': [{ path: string }, boolean];
  'shell.pickFolder': [{ title?: string }, string | null];
  'shell.pickFile': [{ title?: string; filter?: string }, string | null];
  /** Asks where to save a PNG; false when the user cancelled. */
  'shell.saveImage': [{ fileName: string; pngBase64: string }, boolean];
  'window.minimize': [void, boolean];
  'window.toggleMaximize': [void, boolean];
  'window.close': [void, boolean];
  'window.startDrag': [void, boolean];
  'window.startResize': [void, boolean];
  /** Answers "window.closing": the app may now quit. */
  'window.readyToQuit': [void, boolean];
  /** The anime of a ruruka:// link waiting for the UI, once; null otherwise. */
  'window.takeMediaLink': [void, number | null];
  'update.check': [void, UpdateInfo | null];
  'update.install': [void, boolean];
  /** Read-only call to the manga site API (`/manga…`, `/at-home/server/…`), proxied because that API has no CORS. */
  'manga.get': [{ path: string }, unknown];
}

export interface BridgeEvents {
  'player.started': { mediaId: number; episode: number };
  'player.watched': { mediaId: number; episode: number; title: string };
  /** Sent at most every 15 s while mpv plays. */
  'player.progress': { mediaId: number; episode: number; positionSeconds: number; durationSeconds: number };
  /** Exact playback state, on pause, after a seek and every 5 s. */
  'player.sync': { mediaId: number; episode: number; positionSeconds: number; durationSeconds: number; isPaused: boolean };
  /** The person at this player paused or seeked; sync corrections don't count. Exactly one value is set. */
  'player.userControl': { mediaId: number; episode: number; positionSeconds: number | null; isPaused: boolean | null };
  /** The player reads these bytes of a stream: answer through `deliverStreamChunk`. */
  'stream.chunkNeeded': { requestId: string; offset: number; length: number };
  /** The episode reached its end; with isPlayerKeptOpen, mpv stays open on the last frame. */
  'player.ended': { mediaId: number; episode: number };
  'player.closed': { mediaId: number; episode: number; watchedRatio: number };
  /** The app is really quitting (not hiding to the tray); answer with "window.readyToQuit" within 5 s. */
  'window.closing': Record<string, never>;
  /** A ruruka:// link reached the running app: collect it with "window.takeMediaLink". */
  'window.mediaLinkOpened': Record<string, never>;
}

type Method = keyof BridgeApi;
type ParamsOf<M extends Method> = BridgeApi[M][0];
type ResultOf<M extends Method> = BridgeApi[M][1];

interface WebViewChannel {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const webview = (window as unknown as { chrome?: { webview?: WebViewChannel } }).chrome?.webview;
const pending = new Map<number, PendingCall>();
const listeners = new Map<string, Set<(payload: never) => void>>();
let nextId = 1;

webview?.addEventListener('message', ({ data }) => {
  if (typeof data !== 'object' || data === null) return;
  if ('event' in data) {
    listeners.get(data.event)?.forEach((listener) => listener(data.payload as never));
    return;
  }
  const call = pending.get(data.id);
  if (!call) return;
  pending.delete(data.id);
  if (data.error) call.reject(new Error(data.error));
  else call.resolve(data.result);
});

export function invoke<M extends Method>(
  method: M,
  ...params: ParamsOf<M> extends void ? [] : [ParamsOf<M>]
): Promise<ResultOf<M>> {
  if (!webview) return Promise.reject(new Error('Ruruka host is not available.'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    webview.postMessage({ id, method, params: params[0] ?? {} });
  });
}

// <-- Des octets bruts passeraient en base64 par le pont : ces deux appels vont à une adresse que le programme intercepte -->
const streamBytesUrl = 'https://stream.ruruka';

/** Host side: reads bytes of the shared file, without any network. */
export async function readSharedChunk(offset: number, length: number): Promise<ArrayBuffer> {
  const response = await fetch(`${streamBytesUrl}/read?offset=${offset}&length=${length}`);
  if (!response.ok) throw new Error('Impossible de lire le fichier partagé.');
  return response.arrayBuffer();
}

/** Friend side: gives the player the bytes it asked for. A raw buffer carries no content type, so no preflight is sent. */
export async function deliverStreamChunk(requestId: string, bytes: ArrayBuffer): Promise<void> {
  const response = await fetch(`${streamBytesUrl}/chunk?requestId=${requestId}`, { method: 'POST', body: bytes });
  if (!response.ok) throw new Error('Le lecteur n’a pas reçu la vidéo.');
}

/** Subscribes to a host event; returns the unsubscribe function. */
export function on<E extends keyof BridgeEvents>(event: E, listener: (payload: BridgeEvents[E]) => void): () => void {
  const set = listeners.get(event) ?? new Set();
  set.add(listener as (payload: never) => void);
  listeners.set(event, set);
  return () => set.delete(listener as (payload: never) => void);
}
