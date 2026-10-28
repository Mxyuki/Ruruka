import type { MediaTitle, MediaType } from '../api/types';

// <-- Filtre (f), catégorie (c) et texte (q) : le format de recherche courant des sites de torrents d'anime -->
const searchCategories: Record<MediaType, string> = { ANIME: '1_2', MANGA: '3_1' };

/**
 * Search sites only match whole words, so "Arawareta!" misses releases named "Arawareta" and
 * "2nd Season" or "(2023)" rule out most releases. Returns the cleaned title and the season it named.
 */
export function normalizeTitle(rawTitle: string): { title: string; season: number } {
  const seasonMatch = rawTitle.match(/\b(\d+)(?:st|nd|rd|th) Season\b|\bSeason (\d+)\b/i);
  const season = Number(seasonMatch?.[1] ?? seasonMatch?.[2] ?? 1);
  const title = rawTitle
    .replace(seasonMatch?.[0] ?? '', ' ')
    .replace(/\(\d{4}\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return { title, season };
}

function searchUrl(site: string, query: string, type: MediaType): string {
  return `${site}/?${new URLSearchParams({ f: '0', c: searchCategories[type], q: query })}`;
}

/** Searches every title variant so releases named only in English or Japanese still show up. */
export function mediaSearchUrl(site: string, title: MediaTitle, type: MediaType): string {
  const titles = [title.romaji, title.english, title.native]
    .filter((name): name is string => Boolean(name))
    .map((name) => normalizeTitle(name).title);
  const unique = [...new Map(titles.map((name) => [name.toLowerCase(), name])).values()];
  return searchUrl(site, unique.map((name) => `(${name})`).join('|'), type);
}

/** Releases are named "Title - 03" or "Title S01E03"; the parentheses keep the site's OR scoped to the episode. */
export function episodeSearchUrl(site: string, rawTitle: string, episodeNumber: number): string {
  const { title, season } = normalizeTitle(rawTitle);
  const episode = String(episodeNumber).padStart(2, '0');
  const seasonEpisode = `S${String(season).padStart(2, '0')}E${episode}`;
  return searchUrl(site, `${title} (${episode}|${seasonEpisode})`, 'ANIME');
}
