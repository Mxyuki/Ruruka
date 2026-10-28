// <-- Aucun site n'est fourni avec l'appli : chaque adresse vient des réglages, telle que l'utilisateur l'a tapée -->

/** A site typed in Settings as a base URL ("monsite.org/" becomes "https://monsite.org"); null when none is set. */
export function siteBase(rawSite: string): string | null {
  const site = rawSite.trim().replace(/\/+$/, '');
  if (!site) return null;
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

/** The site's name as shown in button titles ("monsite.org"). */
export const siteName = (site: string) => site.replace(/^https?:\/\//i, '');

/** The same site under a subdomain ("uploads" turns https://monsite.org into https://uploads.monsite.org); null for an unusable address. */
export function withSubdomain(site: string, subdomain: string): string | null {
  if (!URL.canParse(site)) return null;
  const url = new URL(site);
  if (!url.hostname.startsWith(`${subdomain}.`)) url.hostname = `${subdomain}.${url.hostname}`;
  return url.origin;
}
