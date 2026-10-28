import type { AnimeSong, SongKind } from '../../api/anisongdb';

export interface SongFilters {
  kinds: Record<SongKind, boolean>;
  name: string;
  artist: string;
  /** How many other singers may share the song with the searched artist; -1 means any number. */
  maxOtherArtists: number;
  composer: string;
  arranger: string;
}

export const emptySongFilters = (): SongFilters => ({
  kinds: { opening: true, ending: true, insert: true },
  name: '',
  artist: '',
  maxOtherArtists: -1,
  composer: '',
  arranger: '',
});

export function hasActiveFilters(filters: SongFilters): boolean {
  const isEveryKindShown = Object.values(filters.kinds).every(Boolean);
  const hasText = [filters.name, filters.artist, filters.composer, filters.arranger].some((text) => text.trim());
  return !isEveryKindShown || hasText || filters.maxOtherArtists !== -1;
}

export function filterSongs(songs: AnimeSong[], filters: SongFilters): AnimeSong[] {
  // <-- Un champ nombre vidé ou contenant juste « - » donne null : on le lit comme « peu importe » -->
  const maxOthers = Number.isInteger(filters.maxOtherArtists) ? filters.maxOtherArtists : -1;
  return songs.filter((song) => {
    if (!filters.kinds[song.kind]) return false;
    if (!includes(song.name, filters.name) || !includes(song.composer, filters.composer) || !includes(song.arranger, filters.arranger)) return false;
    if (!filters.artist.trim()) return true;
    const others = otherArtistCount(song, filters.artist);
    return others !== null && (maxOthers < 0 || others <= maxOthers);
  });
}

// <-- Un membre de groupe compte : chercher « Rikako Aida » trouve aussi les chansons d'Aqours, avec ses 8 camarades en « autres » -->
function otherArtistCount(song: AnimeSong, query: string): number | null {
  const matches = (names: string[]) => names.some((name) => includes(name, query));
  const othersBeside = song.performers.length - 1;
  for (const performer of song.performers) {
    if (matches(performer.names)) return othersBeside;
    if (performer.members.some(matches)) return othersBeside + performer.members.length - 1;
  }
  return includes(song.artist, query) ? Math.max(othersBeside, 0) : null;
}

// <-- Sans tenir compte des majuscules ni des accents : « shuka » trouve « SHUKA », « pokemon » trouve « Pokémon » -->
const normalize = (text: string) => text.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function includes(text: string | null, query: string): boolean {
  const needle = normalize(query.trim());
  return !needle || (text !== null && normalize(text).includes(needle));
}
