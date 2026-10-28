import type { Component } from 'svelte';
import type { MediaType } from '../api/types';
import type { RouteDefinition } from './router.svelte';

// <-- Chaque page reçoit `params` ; celles qui n'en ont pas besoin l'ignorent -->
const page = (load: () => Promise<{ default: Component<never> }>) => load as RouteDefinition['load'];

/** Pages load on first visit so startup only parses the shell and the current page. */
export const routes: RouteDefinition[] = [
  { pattern: '/', load: page(() => import('../pages/home/HomePage.svelte')) },
  { pattern: '/list/:type', load: page(() => import('../pages/list/ListPage.svelte')) },
  { pattern: '/media/:id', load: page(() => import('../pages/media/MediaPage.svelte')) },
  { pattern: '/search/:type', load: page(() => import('../pages/search/SearchPage.svelte')) },
  { pattern: '/people', load: page(() => import('../pages/people/PeoplePage.svelte')) },
  { pattern: '/character/:id', load: page(() => import('../pages/character/CharacterPage.svelte')) },
  { pattern: '/staff/:id', load: page(() => import('../pages/staff/StaffPage.svelte')) },
  { pattern: '/studio/:id', load: page(() => import('../pages/studio/StudioPage.svelte')) },
  { pattern: '/social', load: page(() => import('../pages/social/SocialPage.svelte')) },
  { pattern: '/notifications', load: page(() => import('../pages/notifications/NotificationsPage.svelte')) },
  { pattern: '/user/:name', load: page(() => import('../pages/profile/ProfilePage.svelte')) },
  { pattern: '/user/:name/list/:type', load: page(() => import('../pages/list/ListPage.svelte')) },
  { pattern: '/about/edit', load: page(() => import('../pages/profile/AboutEditorPage.svelte')) },
  { pattern: '/library', load: page(() => import('../pages/library/LibraryPage.svelte')) },
  { pattern: '/settings', load: page(() => import('../pages/settings/SettingsPage.svelte')) },
];

export const mediaPath = (id: number) => `/media/${id}`;
export const characterPath = (id: number) => `/character/${id}`;
export const staffPath = (id: number) => `/staff/${id}`;
export const studioPath = (id: number) => `/studio/${id}`;
export const userPath = (name: string) => `/user/${encodeURIComponent(name)}`;
export const userListPath = (name: string, type: MediaType) => `${userPath(name)}/list/${type === 'MANGA' ? 'manga' : 'anime'}`;
export const aboutEditorPath = '/about/edit';

const anilistLink = /^https?:\/\/anilist\.co\/(anime|manga|character|staff|studio|user)\/([^/?#]+)/;

/** Maps an anilist.co URL to the matching in-app route, or null when there is none. */
export function internalPathFor(url: string): string | null {
  const match = url.match(anilistLink);
  if (!match) return null;
  const [, kind, id = ''] = match;
  if (kind === 'anime' || kind === 'manga') return `/media/${id}`;
  return `/${kind}/${id}`;
}

const anilistSite = 'https://anilist.co';

/**
 * The anilist.co page matching an in-app path, or null when the page exists only in Ruruka.
 * Media pages are not handled here: their address needs the media type (see `fetchMediaSiteUrl`).
 */
export function anilistUrlFor(path: string): string | null {
  const [pathname = ''] = path.split('?');
  const [kind, id, section, listType] = pathname.split('/').filter(Boolean);
  if (!id) return kind === 'people' ? `${anilistSite}/search/characters` : null;
  if (kind === 'character' || kind === 'staff' || kind === 'studio') return `${anilistSite}/${kind}/${id}`;
  if (kind === 'search') return `${anilistSite}/search/${id}`;
  if (kind !== 'user') return null;
  if (section === 'list') return `${anilistSite}/user/${id}/${listType === 'manga' ? 'mangalist' : 'animelist'}`;
  return `${anilistSite}/user/${id}`;
}
