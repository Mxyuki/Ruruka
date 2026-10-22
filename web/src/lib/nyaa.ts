import type { MediaTitle, MediaType } from '../api/types';

const nyaaUrl = 'https://nyaa.si/';
const nyaaCategories: Record<MediaType, string> = { ANIME: '1_2', MANGA: '3_1' };

/**
 * Nyaa only matches whole words, so "Arawareta!" misses releases named "Arawareta" and
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

function searchUrl(query: string, type: MediaType): string {
  return `${nyaaUrl}?${new URLSearchParams({ f: '0', c: nyaaCategories[type], q: query })}`;
}

/** Searches every title variant so releases named only in English or Japanese still show up. */
export function nyaaMediaSearchUrl(title: MediaTitle, type: MediaType): string {
  const titles = [title.romaji, title.english, title.native]
    .filter((name): name is string => Boolean(name))
    .map((name) => normalizeTitle(name).title);
  const unique = [...new Map(titles.map((name) => [name.toLowerCase(), name])).values()];
  return searchUrl(unique.map((name) => `(${name})`).join('|'), type);
}

/** Releases are named "Title - 03" or "Title S01E03"; the parentheses keep Nyaa's OR scoped to the episode. */
export function nyaaEpisodeSearchUrl(rawTitle: string, episodeNumber: number): string {
  const { title, season } = normalizeTitle(rawTitle);
  const episode = String(episodeNumber).padStart(2, '0');
  const seasonEpisode = `S${String(season).padStart(2, '0')}E${episode}`;
  return searchUrl(`${title} (${episode}|${seasonEpisode})`, 'ANIME');
}
