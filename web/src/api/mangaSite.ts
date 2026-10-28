import { invoke } from '../lib/bridge';
import { withSubdomain } from '../lib/siteAddress';
import { cached, minuteMs } from './cache';
import type { MediaTitle } from './types';

// <-- Les chapitres pornographiques restent exclus, comme le reste de l'appli (isAdult: false) -->
const contentRatings = ['safe', 'suggestive', 'erotica'];
const feedPageSize = 500;
const maxFeedPages = 6;

export interface SiteManga {
  id: string;
  /** Languages with at least one translated chapter, as language codes ("fr", "pt-br"…). */
  languages: string[];
}

export interface MangaChapter {
  id: string;
  /** Chapter number as a number for sorting and progress; null for oneshots. */
  number: number | null;
  /** The chapter as the site writes it ("12", "12.5"). */
  label: string | null;
  volume: number | null;
  title: string | null;
  /** The scanlation team(s) behind this version, else its uploader, or null when the site credits no one. */
  group: string | null;
  pageCount: number;
  /** Chapters hosted by a publisher (MANGA Plus…) can only be read on their site. */
  externalUrl: string | null;
}

interface RawRelationship {
  type: string;
  attributes?: { name?: string; username?: string };
}

interface RawManga {
  id: string;
  attributes: { links: Record<string, string> | null; availableTranslatedLanguages: (string | null)[] };
}

interface RawChapter {
  id: string;
  attributes: { chapter: string | null; volume: string | null; title: string | null; pages: number; externalUrl: string | null };
  relationships: RawRelationship[];
}

interface ApiList<T> {
  data: T[];
  total: number;
}

interface AtHome {
  baseUrl: string;
  chapter: { hash: string; data: string[] };
}

export interface MangaLookup {
  id: number;
  idMal: number | null;
  title: MediaTitle;
}

function get<T>(path: string, params: [string, string][] = []): Promise<T> {
  const query = params.length ? `?${new URLSearchParams(params)}` : '';
  return invoke('manga.get', { path: `${path}${query}` }) as Promise<T>;
}

/** The manga site's entry linked to this AniList manga (via its AniList, then MAL id), or null. */
export function findSiteManga(media: MangaLookup): Promise<SiteManga | null> {
  return cached(`manga:${media.id}`, 60 * minuteMs, async () => {
    for (const title of new Set([media.title.romaji, media.title.english, media.title.native])) {
      if (!title) continue;
      const { data } = await get<ApiList<RawManga>>('/manga', [
        ['title', title],
        ['limit', '20'],
        ...contentRatings.map((rating): [string, string] => ['contentRating[]', rating]),
      ]);
      const linked =
        data.find((manga) => manga.attributes.links?.al === String(media.id)) ??
        data.find((manga) => media.idMal !== null && manga.attributes.links?.mal === String(media.idMal));
      if (linked) {
        const languages = linked.attributes.availableTranslatedLanguages.filter((code): code is string => Boolean(code));
        return { id: linked.id, languages };
      }
    }
    return null;
  });
}

/** Every translated version of every chapter in `language`, in reading order (several teams may translate one chapter). */
export function fetchChapters(mangaId: string, language: string): Promise<MangaChapter[]> {
  return cached(`manga:feed:${mangaId}:${language}`, 10 * minuteMs, async () => {
    const raw: RawChapter[] = [];
    for (let page = 0; page < maxFeedPages; page++) {
      const { data, total } = await get<ApiList<RawChapter>>(`/manga/${mangaId}/feed`, [
        ['translatedLanguage[]', language],
        ['order[volume]', 'asc'],
        ['order[chapter]', 'asc'],
        ['includes[]', 'scanlation_group'],
        ['includes[]', 'user'],
        ['limit', String(feedPageSize)],
        ['offset', String(page * feedPageSize)],
        ...contentRatings.map((rating): [string, string] => ['contentRating[]', rating]),
      ]);
      raw.push(...data);
      if (raw.length >= total || !data.length) break;
    }
    return raw.map(toChapter).sort((a, b) => (a.number ?? -1) - (b.number ?? -1));
  });
}

function toChapter(raw: RawChapter): MangaChapter {
  const { chapter, volume, title, pages, externalUrl } = raw.attributes;
  const teams = raw.relationships.filter((relation) => relation.type === 'scanlation_group').map((relation) => relation.attributes?.name).filter(Boolean);
  // <-- Sans équipe déclarée, le site crédite la personne qui a mis le chapitre en ligne : on fait pareil -->
  const uploader = raw.relationships.find((relation) => relation.type === 'user')?.attributes?.username ?? null;
  return {
    id: raw.id,
    number: chapter !== null && Number.isFinite(Number(chapter)) ? Number(chapter) : null,
    label: chapter,
    volume: volume !== null && Number.isFinite(Number(volume)) ? Number(volume) : null,
    title: title || null,
    group: teams.length ? teams.join(' & ') : uploader,
    pageCount: pages,
    externalUrl,
  };
}

export interface ChapterPage {
  url: string;
  /** The same image on the site's main server, for when a volunteer image server fails. */
  fallbackUrl: string;
}

/**
 * A chapter's pages. The image servers rotate, so this is cached briefly. `mangaSite` is the site from
 * Settings: the image servers run by volunteers sometimes fail, and its "uploads" server holds the same files.
 */
export function fetchChapterPages(chapterId: string, mangaSite: string): Promise<ChapterPage[]> {
  return cached(`manga:pages:${mangaSite}:${chapterId}`, 10 * minuteMs, async () => {
    const { baseUrl, chapter } = await get<AtHome>(`/at-home/server/${chapterId}`);
    const fallbackHost = withSubdomain(mangaSite, 'uploads');
    return chapter.data.map((file) => {
      const path = `/data/${chapter.hash}/${file}`;
      return { url: `${baseUrl}${path}`, fallbackUrl: `${fallbackHost ?? baseUrl}${path}` };
    });
  });
}
