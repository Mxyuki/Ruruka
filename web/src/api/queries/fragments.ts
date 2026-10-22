/** Matches the `MediaSummary` type; spread inside any `media { … }` selection. */
export const mediaSummaryFields = `
  id
  type
  format
  status
  title { romaji english native userPreferred }
  synonyms
  coverImage { medium large color }
  bannerImage
  episodes
  chapters
  averageScore
  season
  seasonYear
  nextAiringEpisode { episode airingAt timeUntilAiring }
`;

/** Matches the `ListEntry` type. */
export const listEntryFields = `
  id
  mediaId
  status
  progress
  progressVolumes
  score
  repeat
  private
  notes
  startedAt { year month day }
  completedAt { year month day }
  updatedAt
  customLists(asArray: true)
  hiddenFromStatusLists
  media { ${mediaSummaryFields} }
`;
