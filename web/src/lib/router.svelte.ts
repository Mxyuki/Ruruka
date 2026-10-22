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

class Router {
  path = $state(currentPath());

  constructor() {
    window.addEventListener('hashchange', () => {
      this.path = currentPath();
      document.querySelector('main')?.scrollTo({ top: 0 });
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

export function isActive(prefix: string): boolean {
  return prefix === '/' ? router.path === '/' : router.path.startsWith(prefix);
}
