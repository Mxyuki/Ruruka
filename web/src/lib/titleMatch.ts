const romanSeasons: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };

/** Lowercases and unifies season wording so "2nd Season", "Season 2" and "II" compare equal. */
export function normalizeForMatch(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(\d+)(?:st|nd|rd|th) season\b/g, 'season $1')
    .replace(/\b(ii|iii|iv|v|vi)\b/g, (roman) => `season ${romanSeasons[roman]}`)
    .replace(/\bs(\d+)\b/g, 'season $1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function bigrams(text: string): Map<string, number> {
  const compact = text.replace(/ /g, '');
  const counts = new Map<string, number>();
  for (let index = 0; index < compact.length - 1; index++) {
    const pair = compact.slice(index, index + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

const seasonOf = (normalized: string) => Number(normalized.match(/\bseason (\d+)\b/)?.[1] ?? 1);

// <-- Deux titres de saisons différentes se ressemblent mais ne sont jamais le même anime -->
const seasonMismatchFactor = 0.5;

/** Sørensen–Dice similarity of character bigrams: 1 for identical titles, 0 for nothing in common. */
export function titleSimilarity(a: string, b: string): number {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const seasonFactor = seasonOf(left) === seasonOf(right) ? 1 : seasonMismatchFactor;

  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  let overlap = 0;
  let total = 0;
  for (const count of leftPairs.values()) total += count;
  for (const [pair, count] of rightPairs) {
    total += count;
    overlap += Math.min(count, leftPairs.get(pair) ?? 0);
  }
  const dice = total ? (2 * overlap) / total : 0;
  return Math.max(dice, isMultiWordSuffix(left, right) ? suffixMatchScore : 0) * seasonFactor;
}

// <-- Les noms de dossier omettent souvent le début du titre : « Nanoha StrikerS » -->
const suffixMatchScore = 0.9;

function isMultiWordSuffix(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.includes(' ') && ` ${longer}`.endsWith(` ${shorter}`);
}

export interface MatchCandidate<T> {
  item: T;
  titles: string[];
}

export interface ScoredMatch<T> {
  item: T;
  score: number;
}

/** Ranks candidates by their best-matching title variant, highest first. */
export function rankMatches<T>(guess: string, candidates: MatchCandidate<T>[]): ScoredMatch<T>[] {
  return candidates
    .map(({ item, titles }) => ({ item, score: Math.max(0, ...titles.map((title) => titleSimilarity(guess, title))) }))
    .sort((a, b) => b.score - a.score);
}
