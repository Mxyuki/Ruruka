import type { Component } from 'svelte';

export type RouteParams = Record<string, string>;

export interface RouteDefinition {
  pattern: string;
  load: () => Promise<{ default: Component<{ params: RouteParams }> }>;
}

export interface RouteMatch {
  route: RouteDefinition;
  params: RouteParams;
  path: string;
}

const currentPath = () => decodeURI(location.hash.replace(/^#/, '')) || '/';

// <-- Chaque entrée d'historique garde son rang : au rang 0, il n'y a plus de page où revenir -->
interface HistoryState {
  depth: number;
}

const depthOf = (state: unknown) => (typeof state === 'object' && state !== null && 'depth' in state ? (state as HistoryState).depth : null);

class Router {
  path = $state(currentPath());
  private depth = $state(depthOf(history.state) ?? 0);
  canGoBack = $derived(this.depth > 0);
  private scrollByDepth = new Map<number, number>();

  constructor() {
    if (depthOf(history.state) === null) history.replaceState({ depth: 0 } satisfies HistoryState, '');
    window.addEventListener('hashchange', () => {
      const main = document.querySelector('main');
      this.scrollByDepth.set(this.depth, main?.scrollTop ?? 0);
      const knownDepth = depthOf(history.state);
      if (knownDepth === null) {
        history.replaceState({ depth: this.depth + 1 } satisfies HistoryState, '');
        this.scrollByDepth.delete(this.depth + 1);
      }
      this.depth = knownDepth ?? this.depth + 1;
      this.path = currentPath();
      main?.scrollTo({ top: 0 });
    });
    // <-- Le bouton « précédent » de la souris revient en arrière, comme dans un navigateur -->
    window.addEventListener('mouseup', (event) => {
      if (event.button === 3) back();
    });
  }

  match(routes: RouteDefinition[]): RouteMatch | null {
    const [pathname = '/'] = this.path.split('?');
    for (const route of routes) {
      const params = matchPattern(route.pattern, pathname);
      if (params) return { route, params, path: this.path };
    }
    return null;
  }

  /** Where the current page was scrolled when the user left it, for pages that restore it once their content is back. */
  savedScroll(): number {
    return this.scrollByDepth.get(this.depth) ?? 0;
  }

  query(): URLSearchParams {
    return new URLSearchParams(this.path.split('?')[1] ?? '');
  }
}

function matchPattern(pattern: string, pathname: string): RouteParams | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: RouteParams = {};
  for (const [index, part] of patternParts.entries()) {
    const value = pathParts[index] ?? '';
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(value);
    else if (part !== value) return null;
  }
  return params;
}

export const router = new Router();

export function navigate(path: string): void {
  location.hash = path;
}

export function back(): void {
  if (router.canGoBack) history.back();
}

/** Rewrites the current address's query without a new history entry, so "back" returns to this state. */
export function replaceQuery(query: URLSearchParams): void {
  const [pathname = '/'] = router.path.split('?');
  const search = query.toString();
  history.replaceState(history.state, '', `#${pathname}${search ? `?${search}` : ''}`);
}

export function isActive(prefix: string): boolean {
  return prefix === '/' ? router.path === '/' : router.path.startsWith(prefix);
}
