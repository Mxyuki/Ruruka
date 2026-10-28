/** "system" follows the Windows app mode (light or dark); "schedule" switches at two times of day. */
export type Theme = 'light' | 'dark' | 'system' | 'schedule';

export interface Settings {
  aniListClientId: string | null;
  isLoggedIn: boolean;
  playerPath: string | null;
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
  /** How far into an episode (in %) playback must reach before it counts as watched. */
  episodeCompletionPercent: number;
  /** The share of an episode (in %) that must really be played; the rest may be skipped. */
  minimumWatchedPercent: number;
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
}

export interface PlaybackTarget {
  mediaId: number;
  episode: number;
  filePath: string;
  title: string;
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
  'player.detect': [void, PlayerStatus];
  'player.setPath': [{ path: string }, boolean];
  'player.play': [PlaybackTarget, boolean];
  'shell.openUrl': [{ url: string }, boolean];
  'shell.openPath': [{ path: string }, boolean];
  'shell.pickFolder': [{ title?: string }, string | null];
  'shell.pickFile': [{ title?: string; filter?: string }, string | null];
  'window.minimize': [void, boolean];
  'window.toggleMaximize': [void, boolean];
  'window.close': [void, boolean];
  'window.startDrag': [void, boolean];
  'window.startResize': [void, boolean];
  /** Answers "window.closing": the app may now quit. */
  'window.readyToQuit': [void, boolean];
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
  /** The episode reached its end; with isPlayerKeptOpen, mpv stays open on the last frame. */
  'player.ended': { mediaId: number; episode: number };
  'player.closed': { mediaId: number; episode: number; watchedRatio: number };
  /** The app is really quitting (not hiding to the tray); answer with "window.readyToQuit" within 5 s. */
  'window.closing': Record<string, never>;
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

/** Subscribes to a host event; returns the unsubscribe function. */
export function on<E extends keyof BridgeEvents>(event: E, listener: (payload: BridgeEvents[E]) => void): () => void {
  const set = listeners.get(event) ?? new Set();
  set.add(listener as (payload: never) => void);
  listeners.set(event, set);
  return () => set.delete(listener as (payload: never) => void);
}
