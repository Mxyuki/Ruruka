import type { MangaChapter } from '../../api/mangaSite';

/** One chapter number with every team's translation of it. */
export interface ChapterGroup {
  key: string;
  number: number | null;
  label: string | null;
  volume: number | null;
  title: string | null;
  /** Readable versions first, then publisher-hosted ones. */
  versions: MangaChapter[];
}

export function groupChapters(chapters: MangaChapter[]): ChapterGroup[] {
  const groups = new Map<string, ChapterGroup>();
  for (const chapter of chapters) {
    const key = chapter.label ?? chapter.id;
    const group = groups.get(key) ?? { key, number: chapter.number, label: chapter.label, volume: null, title: null, versions: [] };
    group.volume ??= chapter.volume;
    group.title ??= chapter.title;
    group.versions.push(chapter);
    groups.set(key, group);
  }
  for (const group of groups.values()) group.versions.sort((a, b) => Number(Boolean(a.externalUrl)) - Number(Boolean(b.externalUrl)));
  return [...groups.values()];
}

export const isReadableGroup = (group: ChapterGroup) => group.versions.some((version) => !version.externalUrl);

// <-- Même équipe que le chapitre d'avant si elle a traduit celui-ci, sinon la version la plus complète -->
export function pickVersion(group: ChapterGroup, preferredTeam: string | null): MangaChapter | null {
  const readable = group.versions.filter((version) => !version.externalUrl);
  const sameTeam = preferredTeam ? readable.find((version) => version.group === preferredTeam) : undefined;
  return sameTeam ?? readable.reduce<MangaChapter | null>((best, version) => (!best || version.pageCount > best.pageCount ? version : best), null);
}

export const chapterName = (group: Pick<ChapterGroup, 'label'>) => (group.label ? `Chapitre ${group.label}` : 'Oneshot');
