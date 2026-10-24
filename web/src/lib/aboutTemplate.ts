/** Every live tag, each value already formatted for display. */
export interface LiveAboutValues {
  anime: string;
  episode: string;
  episodes: string;
  time: string;
  duration: string;
  remaining: string;
  percent: string;
  cover: string;
  banner: string;
  link: string;
  updated: string;
}

export interface LiveAboutState {
  isWatching: boolean;
  values: LiveAboutValues;
}

const blockPattern = /\[(watching|idle)\]([\s\S]*?)\[\/\1\]/gi;
const tagPattern = /\$\{(\w+)\}/g;
const tagNames = new Set(['anime', 'episode', 'episodes', 'time', 'duration', 'remaining', 'percent', 'cover', 'banner', 'link', 'updated']);

/** True when the text uses at least one live tag, so it must be kept locally as a template. */
export function hasLiveTags(text: string): boolean {
  if (new RegExp(blockPattern.source, 'i').test(text)) return true;
  return [...text.matchAll(tagPattern)].some(([, name = '']) => tagNames.has(name.toLowerCase()));
}

// <-- Les blocs d'abord (on garde celui de l'état courant), puis les balises ; une balise inconnue reste telle quelle -->
export function fillAboutTemplate(template: string, state: LiveAboutState): string {
  const values: Record<string, string> = { ...state.values };
  return template
    .replace(blockPattern, (_, block: string, inner: string) => ((block.toLowerCase() === 'watching') === state.isWatching ? inner : ''))
    .replace(tagPattern, (tag, name: string) => values[name.toLowerCase()] ?? tag);
}

/** `seconds` as m:ss, or h:mm:ss past an hour. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
