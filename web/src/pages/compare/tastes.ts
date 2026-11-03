import type { ComparisonEntry } from '../../api/queries/list';

/** Anything but « à voir » means the user has started it. */
export const isSeen = (entry: ComparisonEntry) => entry.status !== 'PLANNING';

export const indexByMedia = (entries: ComparisonEntry[]) => new Map(entries.map((entry) => [entry.mediaId, entry]));

export interface Affinity {
  /** Pearson correlation of both users' scores, as a percentage (−100…100); null without enough shared scores. */
  percent: number | null;
  sharedScored: number;
  sharedSeen: number;
}

const minSharedScores = 5;

function correlationPercent(pairs: [number, number][]): number | null {
  const count = pairs.length;
  const meanA = pairs.reduce((sum, [a]) => sum + a, 0) / count;
  const meanB = pairs.reduce((sum, [, b]) => sum + b, 0) / count;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (const [a, b] of pairs) {
    covariance += (a - meanA) * (b - meanB);
    varianceA += (a - meanA) ** 2;
    varianceB += (b - meanB) ** 2;
  }
  if (!varianceA || !varianceB) return null;
  return Math.round((covariance / Math.sqrt(varianceA * varianceB)) * 100);
}

// <-- Même calcul que les outils d'affinité AniList : corrélation des notes sur les titres vus et notés par les deux -->
export function affinityOf(mine: ComparisonEntry[], theirs: ComparisonEntry[]): Affinity {
  const theirsByMedia = indexByMedia(theirs);
  const pairs: [number, number][] = [];
  let sharedSeen = 0;
  for (const entry of mine) {
    const other = theirsByMedia.get(entry.mediaId);
    if (!other || !isSeen(entry) || !isSeen(other)) continue;
    sharedSeen++;
    if (entry.score100 && other.score100) pairs.push([entry.score100, other.score100]);
  }
  const percent = pairs.length >= minSharedScores ? correlationPercent(pairs) : null;
  return { percent, sharedScored: pairs.length, sharedSeen };
}

export type TasteKind = 'genre' | 'tag';

interface Feature {
  name: string;
  kind: TasteKind;
  count: number;
  /** Mean 0–100 score of the scored titles with this feature, or null. */
  meanScore: number | null;
  /** How much the user seems to like it: score above their own mean, plus a bonus for how often they watch it. */
  weight: number;
}

export type TasteProfile = Map<string, Feature>;

/** A tag counts toward tastes only when most voters agree it fits the media. */
const strongTagRank = 60;
const frequencyBonus = 30;

export const featureKey = (kind: TasteKind, name: string) => `${kind}:${name}`;

/** The genres and strong, spoiler-free tags of a media, as profile keys. */
export function featuresOf(media: ComparisonEntry['media']): [TasteKind, string][] {
  const tags = media.tags.filter((tag) => tag.rank >= strongTagRank && !tag.isMediaSpoiler).map((tag): [TasteKind, string] => ['tag', tag.name]);
  return [...media.genres.map((genre): [TasteKind, string] => ['genre', genre]), ...tags];
}

export function tasteProfile(entries: ComparisonEntry[]): TasteProfile {
  const seen = entries.filter(isSeen);
  const scored = seen.filter((entry) => entry.score100 > 0);
  const overallMean = scored.length ? scored.reduce((sum, entry) => sum + entry.score100, 0) / scored.length : 0;

  const totals = new Map<string, { kind: TasteKind; name: string; count: number; scoreSum: number; scoredCount: number }>();
  for (const entry of seen) {
    for (const [kind, name] of featuresOf(entry.media)) {
      const key = featureKey(kind, name);
      const total = totals.get(key) ?? { kind, name, count: 0, scoreSum: 0, scoredCount: 0 };
      total.count++;
      if (entry.score100) {
        total.scoreSum += entry.score100;
        total.scoredCount++;
      }
      totals.set(key, total);
    }
  }

  const profile: TasteProfile = new Map();
  for (const [key, total] of totals) {
    const meanScore = total.scoredCount ? total.scoreSum / total.scoredCount : null;
    const liking = meanScore !== null && total.scoredCount >= 2 && overallMean ? meanScore - overallMean : 0;
    const weight = liking + frequencyBonus * (total.count / seen.length);
    profile.set(key, { name: total.name, kind: total.kind, count: total.count, meanScore, weight });
  }
  return profile;
}

export interface SharedTaste {
  name: string;
  mine: Feature;
  theirs: Feature;
}

const minTasteCount = 3;

/** Genres or tags both users watch often and score well, best first. */
export function sharedTastes(mine: TasteProfile, theirs: TasteProfile, kind: TasteKind, limit: number): SharedTaste[] {
  const shared: SharedTaste[] = [];
  for (const [key, feature] of mine) {
    const other = theirs.get(key);
    if (feature.kind !== kind || !other) continue;
    if (feature.count < minTasteCount || other.count < minTasteCount || feature.weight <= 0 || other.weight <= 0) continue;
    shared.push({ name: feature.name, mine: feature, theirs: other });
  }
  return shared.sort((a, b) => Math.min(b.mine.weight, b.theirs.weight) - Math.min(a.mine.weight, a.theirs.weight)).slice(0, limit);
}

/** How well a media fits a profile: the mean weight of its features the profile knows. */
export function tasteMatch(media: ComparisonEntry['media'], profile: TasteProfile): number {
  const weights = featuresOf(media)
    .map(([kind, name]) => profile.get(featureKey(kind, name))?.weight)
    .filter((weight): weight is number => weight !== undefined);
  return weights.length ? weights.reduce((sum, weight) => sum + weight, 0) / weights.length : 0;
}
