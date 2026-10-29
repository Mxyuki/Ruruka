import { gql } from '../client';
import { cached, minuteMs } from '../cache';
import type { FuzzyDate, MediaSummary, NamedNode, PageInfo } from '../types';
import { mediaSummaryFields } from './fragments';

interface PersonName {
  full: string;
  native: string | null;
  alternative: string[];
  userPreferred: string;
}

export interface CharacterDetails {
  id: number;
  name: PersonName;
  image: { large: string };
  description: string | null;
  gender: string | null;
  age: string | null;
  bloodType: string | null;
  dateOfBirth: FuzzyDate;
  favourites: number;
  media: { characterRole: string; voiceRoles: VoiceRole[]; node: MediaSummary }[];
}

export interface VoiceRole {
  voiceActor: NamedNode;
  /** AniList's free-text precision, e.g. "Child" when another seiyuu voices the adult. */
  roleNotes: string | null;
}

interface RawCharacterEdge {
  characterRole: string;
  voiceActorRoles: { voiceActor: NamedNode | null; roleNotes: string | null }[];
  node: MediaSummary;
}

const characterQuery = `
  query ($id: Int) {
    Character(id: $id) {
      id
      name { full native alternative userPreferred }
      image { large }
      description(asHtml: true)
      gender
      age
      bloodType
      dateOfBirth { year month day }
      favourites
      media(sort: POPULARITY_DESC, perPage: 30) {
        edges {
          characterRole
          voiceActorRoles(language: JAPANESE) { roleNotes voiceActor { id name { userPreferred } image { medium } } }
          node { ${mediaSummaryFields} }
        }
      }
    }
  }
`;

export function fetchCharacter(id: number): Promise<CharacterDetails> {
  return cached(`character:${id}`, 10 * minuteMs, async () => {
    const { Character } = await gql<{ Character: Omit<CharacterDetails, 'media'> & { media: { edges: RawCharacterEdge[] } } }>(
      characterQuery,
      { id },
    );
    // <-- AniList renvoie null pour un seiyuu supprimé ou masqué -->
    const media = Character.media.edges.map(({ voiceActorRoles, ...edge }) => ({
      ...edge,
      voiceRoles: voiceActorRoles.filter((role): role is VoiceRole => role.voiceActor !== null),
    }));
    return { ...Character, media };
  });
}

export interface VoicedCharacter {
  character: NamedNode & { favourites: number };
  characterRole: string;
  media: MediaSummary;
  /** Start year of that first appearance, null when AniList doesn't know it yet. */
  year: number | null;
}

export interface StaffDetails {
  id: number;
  name: PersonName;
  image: { large: string };
  description: string | null;
  primaryOccupations: string[];
  gender: string | null;
  age: number | null;
  homeTown: string | null;
  yearsActive: number[];
  dateOfBirth: FuzzyDate;
  favourites: number;
  /** Every voiced character once, with its first appearance (earliest media), newest first. */
  characterRoles: VoicedCharacter[];
  staffRoles: { staffRole: string; node: MediaSummary }[];
}

const staffQuery = `
  query ($id: Int) {
    Staff(id: $id) {
      id
      name { full native alternative userPreferred }
      image { large }
      description(asHtml: true)
      primaryOccupations
      gender
      age
      homeTown
      yearsActive
      dateOfBirth { year month day }
      favourites
      staffMedia(sort: POPULARITY_DESC, perPage: 30) {
        edges { staffRole node { ${mediaSummaryFields} } }
      }
    }
  }
`;

type RawStaff = Omit<StaffDetails, 'characterRoles' | 'staffRoles'> & {
  staffMedia: { edges: StaffDetails['staffRoles'] };
};

interface CharacterMediaEdge {
  characterRole: string;
  characters: ((NamedNode & { favourites: number }) | null)[];
  node: MediaSummary & { startDate: { year: number | null } };
}

// <-- AniList sert 25 rôles par page au plus : on demande 5 pages par requête (alias p0…p4) pour ménager la limite de débit -->
const pagesPerRequest = 5;
// <-- Garde-fou pour les doubleurs aux centaines de rôles : 40 pages couvrent 1 000 rôles -->
const maxCharacterPages = 40;
const characterEdgeFields = `edges { characterRole characters { id name { userPreferred } image { medium } favourites } node { ${mediaSummaryFields} startDate { year } } }`;

// <-- Du plus ancien au plus récent : la première fois qu'on croise un personnage, c'est sa première apparition -->
function staffCharactersQuery(firstPage: number): string {
  const pages = Array.from({ length: pagesPerRequest }, (_, offset) => {
    return `p${offset}: characterMedia(sort: START_DATE, page: ${firstPage + offset}, perPage: 25) { pageInfo { hasNextPage } ${characterEdgeFields} }`;
  });
  return `query ($id: Int) { Staff(id: $id) { ${pages.join(' ')} } }`;
}

async function fetchVoicedCharacters(id: number): Promise<VoicedCharacter[]> {
  const seen = new Map<number, VoicedCharacter>();
  for (let firstPage = 1; firstPage <= maxCharacterPages; firstPage += pagesPerRequest) {
    const { Staff } = await gql<{ Staff: Record<string, { pageInfo: PageInfo; edges: CharacterMediaEdge[] }> }>(staffCharactersQuery(firstPage), { id });
    const pages = Array.from({ length: pagesPerRequest }, (_, offset) => Staff[`p${offset}`]).filter((page) => page !== undefined);
    for (const edge of pages.flatMap((page) => page.edges)) {
      for (const character of edge.characters) {
        // <-- AniList renvoie null pour un personnage supprimé ou masqué -->
        if (!character) continue;
        // <-- AniList range les œuvres sans date en tête : une œuvre datée passe devant elles -->
        const known = seen.get(character.id);
        const year = edge.node.startDate.year;
        if (!known || (known.year === null && year !== null)) seen.set(character.id, { character, characterRole: edge.characterRole, media: edge.node, year });
      }
    }
    if (!pages.at(-1)?.pageInfo.hasNextPage) break;
  }
  // <-- Les plus récents d'abord ; une date encore inconnue (projet annoncé) passe en tête -->
  return [...seen.values()].sort((a, b) => (b.year ?? Infinity) - (a.year ?? Infinity));
}

export function fetchStaff(id: number): Promise<StaffDetails> {
  return cached(`staff:${id}`, 10 * minuteMs, async () => {
    const [{ Staff }, characterRoles] = await Promise.all([gql<{ Staff: RawStaff }>(staffQuery, { id }), fetchVoicedCharacters(id)]);
    const { staffMedia, ...rest } = Staff;
    return { ...rest, characterRoles, staffRoles: staffMedia.edges };
  });
}

export interface StudioDetails {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  favourites: number;
  media: MediaSummary[];
}

const studioQuery = `
  query ($id: Int) {
    Studio(id: $id) {
      id
      name
      isAnimationStudio
      favourites
      media(sort: START_DATE_DESC, isMain: true, perPage: 50) { nodes { ${mediaSummaryFields} } }
    }
  }
`;

export function fetchStudio(id: number): Promise<StudioDetails> {
  return cached(`studio:${id}`, 10 * minuteMs, async () => {
    const { Studio } = await gql<{ Studio: Omit<StudioDetails, 'media'> & { media: { nodes: MediaSummary[] } } }>(studioQuery, { id });
    return { ...Studio, media: Studio.media.nodes };
  });
}

export interface PersonResult {
  id: number;
  name: { userPreferred: string; native: string | null };
  image: { medium: string };
  favourites: number;
}

export interface CharacterResult extends PersonResult {
  /** The character's most popular appearance, to tell namesakes apart. */
  media: { nodes: { id: number; title: { userPreferred: string } }[] };
}

export interface StaffResult extends PersonResult {
  primaryOccupations: string[];
}

export interface PeopleSearch {
  characters: CharacterResult[];
  staff: StaffResult[];
}

// <-- Personnages et créateurs en une seule requête ; sans texte, les plus aimés -->
const peopleSearchQuery = `
  query ($search: String, $characterSort: [CharacterSort], $staffSort: [StaffSort]) {
    characters: Page(perPage: 30) {
      characters(search: $search, sort: $characterSort) {
        id name { userPreferred native } image { medium } favourites
        media(perPage: 1, sort: POPULARITY_DESC) { nodes { id title { userPreferred } } }
      }
    }
    staff: Page(perPage: 30) {
      staff(search: $search, sort: $staffSort) { id name { userPreferred native } image { medium } favourites primaryOccupations }
    }
  }
`;

export function searchPeople(search: string): Promise<PeopleSearch> {
  const text = search.trim();
  const variables = {
    search: text || undefined,
    characterSort: [text ? 'SEARCH_MATCH' : 'FAVOURITES_DESC'],
    staffSort: [text ? 'SEARCH_MATCH' : 'FAVOURITES_DESC'],
  };
  return cached(`people:${text.toLowerCase()}`, 5 * minuteMs, async () => {
    const result = await gql<{ characters: { characters: CharacterResult[] }; staff: { staff: StaffResult[] } }>(peopleSearchQuery, variables);
    return { characters: result.characters.characters, staff: result.staff.staff };
  });
}
