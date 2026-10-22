import { gql } from '../client';
import { cached, minuteMs } from '../cache';
import type { FuzzyDate, MediaSummary, NamedNode } from '../types';
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
  media: { characterRole: string; voiceActors: NamedNode[]; node: MediaSummary }[];
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
          voiceActors(language: JAPANESE) { id name { userPreferred } image { medium } }
          node { ${mediaSummaryFields} }
        }
      }
    }
  }
`;

export function fetchCharacter(id: number): Promise<CharacterDetails> {
  return cached(`character:${id}`, 10 * minuteMs, async () => {
    const { Character } = await gql<{ Character: Omit<CharacterDetails, 'media'> & { media: { edges: CharacterDetails['media'] } } }>(
      characterQuery,
      { id },
    );
    return { ...Character, media: Character.media.edges };
  });
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
  characterRoles: { characterRole: string; characters: NamedNode[]; node: MediaSummary }[];
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
      characterMedia(sort: POPULARITY_DESC, perPage: 30) {
        edges { characterRole characters { id name { userPreferred } image { medium } } node { ${mediaSummaryFields} } }
      }
      staffMedia(sort: POPULARITY_DESC, perPage: 30) {
        edges { staffRole node { ${mediaSummaryFields} } }
      }
    }
  }
`;

type RawStaff = Omit<StaffDetails, 'characterRoles' | 'staffRoles'> & {
  characterMedia: { edges: StaffDetails['characterRoles'] };
  staffMedia: { edges: StaffDetails['staffRoles'] };
};

export function fetchStaff(id: number): Promise<StaffDetails> {
  return cached(`staff:${id}`, 10 * minuteMs, async () => {
    const { Staff } = await gql<{ Staff: RawStaff }>(staffQuery, { id });
    const { characterMedia, staffMedia, ...rest } = Staff;
    return { ...rest, characterRoles: characterMedia.edges, staffRoles: staffMedia.edges };
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
