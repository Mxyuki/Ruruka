import { cached, minuteMs } from './cache';
import type { MediaTitle } from './types';

const apiUrl = 'https://anisongdb.com/api';
const timeoutMs = 20_000;

export type SongKind = 'opening' | 'ending' | 'insert';

/** One credited singer or group; a group lists the names of each member. */
export interface SongPerformer {
  names: string[];
  members: string[][];
}

export interface AnimeSong {
  id: number;
  kind: SongKind;
  /** "Opening 2" gives 2; insert songs have none. */
  number: number | null;
  name: string;
  artist: string;
  performers: SongPerformer[];
  composer: string | null;
  arranger: string | null;
  lengthSeconds: number | null;
  isDub: boolean;
  isRebroadcast: boolean;
  /** AnisongDB only names the files; the server that hosts them is chosen in Settings. */
  videoHqFile: string | null;
  videoMqFile: string | null;
  audioFile: string | null;
}

interface RawArtist {
  names: string[];
  members: { names: string[] }[] | null;
}

interface RawSong {
  annSongId: number;
  linked_ids: { anilist: number | null; myanimelist: number | null } | null;
  songType: string;
  songName: string;
  songArtist: string;
  artists: RawArtist[] | null;
  songComposer: string | null;
  songArranger: string | null;
  songLength: number | null;
  isDub: boolean;
  isRebroadcast: boolean;
  HQ: string | null;
  MQ: string | null;
  audio: string | null;
}

export interface SongLookup {
  id: number;
  idMal: number | null;
  title: MediaTitle;
}

const kindOrder: SongKind[] = ['opening', 'ending', 'insert'];

/** Every song AnisongDB knows for this anime, openings first. Results stay in memory for 30 min. */
export function fetchAnimeSongs(media: SongLookup): Promise<AnimeSong[]> {
  return cached(`anisongs:${media.id}`, 30 * minuteMs, async () => {
    const raw = await findSongs(media);
    return raw.map(toSong).sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || (a.number ?? 0) - (b.number ?? 0));
  });
}

// <-- Par id MAL d'abord (exact), puis par titre romaji et anglais ; on ne garde que les musiques liées à cet id AniList -->
async function findSongs(media: SongLookup): Promise<RawSong[]> {
  if (media.idMal) {
    const byMal = await request('mal_ids_request', { mal_ids: [media.idMal] });
    const matching = byMal.filter((song) => (song.linked_ids?.anilist ?? media.id) === media.id);
    if (matching.length) return dedupe(matching);
  }
  for (const title of new Set([media.title.romaji, media.title.english])) {
    if (!title) continue;
    const byTitle = await request('search_request', {
      anime_search_filter: { search: title, partial_match: false },
      and_logic: false,
      ignore_dups: false,
      opening_filter: true,
      ending_filter: true,
      insert_filter: true,
    });
    const matching = byTitle.filter((song) => song.linked_ids?.anilist === media.id);
    if (matching.length) return dedupe(matching);
  }
  return [];
}

async function request(endpoint: string, body: unknown): Promise<RawSong[]> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error('AnisongDB ne répond pas.');
  }
  if (!response.ok) throw new Error(`AnisongDB a refusé la recherche (${response.status}).`);
  const songs: unknown = await response.json();
  return Array.isArray(songs) ? (songs as RawSong[]) : [];
}

const dedupe = (songs: RawSong[]) => [...new Map(songs.map((song) => [song.annSongId, song])).values()];

function toSong(raw: RawSong): AnimeSong {
  const [, type = '', number] = raw.songType.match(/^(\w+)\s*(\d+)?/) ?? [];
  const kind: SongKind = type.toLowerCase() === 'opening' ? 'opening' : type.toLowerCase() === 'ending' ? 'ending' : 'insert';
  return {
    id: raw.annSongId,
    kind,
    number: number ? Number(number) : null,
    name: raw.songName,
    artist: raw.songArtist,
    performers: (raw.artists ?? []).map((artist) => ({ names: artist.names, members: (artist.members ?? []).map((member) => member.names) })),
    composer: raw.songComposer,
    arranger: raw.songArranger,
    lengthSeconds: raw.songLength,
    isDub: raw.isDub,
    isRebroadcast: raw.isRebroadcast,
    videoHqFile: raw.HQ,
    videoMqFile: raw.MQ,
    audioFile: raw.audio,
  };
}
