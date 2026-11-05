import type { AiringEpisode, FuzzyDate, MediaStatus } from '../../api/types';

const daySeconds = 86_400;
const defaultCadenceDays = 7;
const maxCadenceDays = 14;

// <-- Sans nombre d'épisodes annoncé, on vise le format probable suivant ; passé le dernier palier, la série n'a plus de fin -->
const assumedEpisodeCounts = [12, 18, 50, 100];

export interface ForecastEpisode extends AiringEpisode {
  /** Computed by Ruruka rather than announced by AniList. */
  isEstimated: boolean;
  /** Only the day is known, not the hour. */
  isDateOnly: boolean;
}

export interface AiringForecast {
  status: MediaStatus | null;
  /** Null for an unknown episode count: the forecast then follows `assumedEpisodeCount`. */
  totalEpisodes: number | null;
  /** Episodes with a date from AniList, aired or not. */
  knownEpisodes: AiringEpisode[];
  startDate: FuzzyDate | null;
  fromSeconds: number;
  toSeconds: number;
  nowSeconds: number;
}

const middle = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Days between two episodes, from the dates AniList gives. The median ignores a one-off break, and
 * episodes sharing a day (double broadcasts) don't count. Falls back on one episode a week.
 */
export function cadenceDays(knownEpisodes: AiringEpisode[]): number {
  const gaps = knownEpisodes
    .slice(1)
    .map((episode, index) => Math.round((episode.airingAt - (knownEpisodes[index]?.airingAt ?? 0)) / daySeconds))
    .filter((days) => days > 0);
  const cadence = middle(gaps) ?? defaultCadenceDays;
  return cadence <= maxCadenceDays ? cadence : defaultCadenceDays;
}

/** How many episodes to expect from a media with no announced count, once `reachedEpisode` has aired. */
export function assumedEpisodeCount(reachedEpisode: number): number {
  return assumedEpisodeCounts.find((count) => count > reachedEpisode) ?? Infinity;
}

// <-- AniList donne souvent la date de début avant les horaires : midi local la garde sur le bon jour -->
function startAnchor(startDate: FuzzyDate | null): AiringEpisode | null {
  if (!startDate?.year || !startDate.month || !startDate.day) return null;
  const noon = new Date(startDate.year, startDate.month - 1, startDate.day, 12);
  return { episode: 1, airingAt: Math.floor(noon.getTime() / 1000) };
}

const canContinue = (status: MediaStatus | null) => status === 'RELEASING' || status === 'NOT_YET_RELEASED';

/**
 * Every episode airing between two dates: AniList's own dates, then one more per cadence past the last
 * of them, up to the announced or assumed episode count. Episodes count in airing seconds, not local days:
 * Japanese broadcasts don't shift with daylight saving time.
 */
export function forecastEpisodes({ status, totalEpisodes, knownEpisodes, startDate, fromSeconds, toSeconds, nowSeconds }: AiringForecast): ForecastEpisode[] {
  const isInRange = ({ airingAt }: AiringEpisode) => airingAt >= fromSeconds && airingAt <= toSeconds;
  const episodes: ForecastEpisode[] = knownEpisodes.filter(isInRange).map((episode) => ({ ...episode, isEstimated: false, isDateOnly: false }));

  const lastKnown = knownEpisodes.at(-1);
  const anchor = lastKnown ?? startAnchor(startDate);
  if (!anchor || !canContinue(status)) return episodes;

  const isDateOnly = !lastKnown;
  if (isDateOnly && isInRange(anchor)) episodes.push({ ...anchor, isEstimated: true, isDateOnly });

  const cadenceSeconds = cadenceDays(knownEpisodes) * daySeconds;
  const hasAnchorAired = anchor.airingAt <= nowSeconds;
  const reachedEpisode = hasAnchorAired ? anchor.episode + Math.floor((nowSeconds - anchor.airingAt) / cadenceSeconds) : anchor.episode - 1;
  const lastEpisode = totalEpisodes ?? assumedEpisodeCount(reachedEpisode);
  const earliest = Math.max(fromSeconds, nowSeconds);
  const firstStep = Math.max(1, Math.ceil((earliest - anchor.airingAt) / cadenceSeconds));
  for (let step = firstStep; ; step++) {
    const episode = anchor.episode + step;
    const airingAt = anchor.airingAt + step * cadenceSeconds;
    if (airingAt > toSeconds || episode > lastEpisode) return episodes;
    episodes.push({ episode, airingAt, isEstimated: true, isDateOnly });
  }
}
