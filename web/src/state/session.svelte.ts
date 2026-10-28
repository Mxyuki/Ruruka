import { AniListError, setAccessToken } from '../api/client';
import { fetchViewer, saveCustomListNames } from '../api/queries/user';
import type { MediaType, Viewer } from '../api/types';
import { invoke, type Settings, type SettingsPatch } from '../lib/bridge';
import { siteBase } from '../lib/siteAddress';

export type SessionStatus = 'loading' | 'setup' | 'ready' | 'error';

class Session {
  settings = $state<Settings | null>(null);
  viewer = $state<Viewer | null>(null);
  error = $state<string | null>(null);
  private isLoading = $state(true);

  // <-- Les sites viennent des réglages ; sans adresse, la fonction qui en dépend reste cachée -->
  /** Base URL of the episode search site; null hides the search buttons. */
  searchSite = $derived(siteBase(this.settings?.searchSiteUrl ?? ''));
  /** Base URL of the manga reading site; null hides chapter reading. */
  mangaSite = $derived(siteBase(this.settings?.mangaSiteUrl ?? ''));
  /** Base URL of the server holding anime song files; null hides the song players. */
  songFileHost = $derived(siteBase(this.settings?.songFileHostUrl ?? ''));

  status: SessionStatus = $derived.by(() => {
    if (this.isLoading) return 'loading';
    if (this.error) return 'error';
    return this.settings?.isSetupComplete && this.viewer ? 'ready' : 'setup';
  });

  async init(): Promise<void> {
    try {
      await this.reloadSettings();
      if (this.settings?.isLoggedIn) await this.loadViewer();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.isLoading = false;
    }
  }

  /** Opens AniList's login window. Resolves false if the user closed it. */
  async login(): Promise<boolean> {
    const isLoggedIn = await invoke('auth.login');
    if (isLoggedIn) await this.loadViewer();
    return isLoggedIn;
  }

  async loginWithToken(token: string): Promise<void> {
    await invoke('auth.setToken', { token });
    await this.loadViewer();
  }

  async logout(): Promise<void> {
    await invoke('auth.logout');
    setAccessToken(null);
    this.viewer = null;
    await this.reloadSettings();
  }

  async updateSettings(patch: SettingsPatch): Promise<void> {
    this.settings = await invoke('settings.update', patch);
  }

  /** Re-reads settings the host may have changed itself, such as a newly detected mpv path. */
  async reloadSettings(): Promise<void> {
    this.settings = await invoke('settings.get');
  }

  /** Custom list names the viewer has created for a media type. */
  customListNames(type: MediaType): string[] {
    const options = this.viewer?.mediaListOptions;
    return (type === 'ANIME' ? options?.animeList.customLists : options?.mangaList.customLists) ?? [];
  }

  // <-- Création d'une liste perso : AniList attend la liste complète des noms -->
  async addCustomList(type: MediaType, name: string): Promise<void> {
    if (!this.viewer) return;
    const names = [...this.customListNames(type), name];
    const saved = await saveCustomListNames(type, names);
    if (type === 'ANIME') this.viewer.mediaListOptions.animeList = saved;
    else this.viewer.mediaListOptions.mangaList = saved;
  }

  markNotificationsRead(): void {
    if (this.viewer) this.viewer.unreadNotificationCount = 0;
  }

  private async loadViewer(): Promise<void> {
    setAccessToken(await invoke('auth.getToken'));
    try {
      this.viewer = await fetchViewer();
      await this.reloadSettings();
    } catch (error) {
      if (!(error instanceof AniListError && error.isUnauthorized)) throw error;
      // <-- Un jeton expiré (au bout d'un an) renvoie simplement vers la connexion -->
      await this.logout();
    }
  }
}

export const session = new Session();
