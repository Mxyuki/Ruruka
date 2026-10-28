import type { MediaType } from '../api/types';

export type MediaSectionId =
  | 'description'
  | 'episodes'
  | 'chapters'
  | 'relations'
  | 'characters'
  | 'staff'
  | 'dashboard'
  | 'tags'
  | 'songs'
  | 'trailer'
  | 'recommendations';

export interface MediaSection {
  id: MediaSectionId;
  label: string;
  /** Shown only on this media type. */
  onlyFor?: MediaType;
}

/** Every media page section, in the default order. */
export const mediaSections: MediaSection[] = [
  { id: 'description', label: 'Le résumé' },
  { id: 'episodes', label: 'Les épisodes', onlyFor: 'ANIME' },
  { id: 'chapters', label: 'Les chapitres', onlyFor: 'MANGA' },
  { id: 'relations', label: 'Le fil des indices' },
  { id: 'characters', label: 'Les suspects' },
  { id: 'staff', label: 'L’équipe' },
  { id: 'dashboard', label: 'Le dossier' },
  { id: 'tags', label: 'Les mots-clés' },
  { id: 'songs', label: 'La bande-son', onlyFor: 'ANIME' },
  { id: 'trailer', label: 'La bande-annonce' },
  { id: 'recommendations', label: 'Pistes similaires' },
];

const knownIds = new Set<string>(mediaSections.map((section) => section.id));

// <-- L'ordre enregistré d'abord ; une section ajoutée depuis par une mise à jour se range à la fin -->
export function orderSections(saved: readonly string[]): MediaSectionId[] {
  const kept = saved.filter((id): id is MediaSectionId => knownIds.has(id));
  const missing = mediaSections.map((section) => section.id).filter((id) => !kept.includes(id));
  return [...new Set([...kept, ...missing])];
}
