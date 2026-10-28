<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import Backdrop from './components/Backdrop.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import LoadingState from './components/LoadingState.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import SkipWarningDialog from './components/SkipWarningDialog.svelte';
  import TitleBar from './components/TitleBar.svelte';
  import Toasts from './components/Toasts.svelte';
  import UpdateDialog from './components/UpdateDialog.svelte';
  import { fetchMediaSiteUrl } from './api/queries/media';
  import { invoke, on } from './lib/bridge';
  import { router } from './lib/router.svelte';
  import { anilistUrlFor, routes, userListPath } from './lib/routes';
  import { installSparkles } from './lib/sparkle';
  import { installSpoilers } from './lib/spoilers';
  import SetupPage from './pages/setup/SetupPage.svelte';
  import { library } from './state/library.svelte';
  import { liveAbout } from './state/liveAbout.svelte';
  import { mediaList } from './state/mediaList.svelte';
  import { playback } from './state/playback.svelte';
  import { session } from './state/session.svelte';
  import { toasts } from './state/toasts.svelte';
  import { updates } from './state/updates.svelte';

  const match = $derived(router.match(routes));

  const reducesMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pageEnter = { y: 12, duration: reducesMotion ? 0 : 280 };

  async function anilistUrlForPath(path: string): Promise<string | null> {
    const mediaId = path.match(/^\/media\/(\d+)/)?.[1];
    if (mediaId) return fetchMediaSiteUrl(Number(mediaId));
    const ownListType = path.match(/^\/list\/(anime|manga)/)?.[1];
    if (ownListType && session.viewer) return anilistUrlFor(userListPath(session.viewer.name, ownListType === 'manga' ? 'MANGA' : 'ANIME'));
    return anilistUrlFor(path);
  }

  // <-- Clic molette ou Ctrl+clic sur un lien interne : WebView2 enverrait app.ruruka au navigateur, on ouvre la page AniList à la place -->
  async function openLinkOnAniList(event: MouseEvent) {
    const isNewTabClick = event.button === 1 || (event.button === 0 && (event.ctrlKey || event.shiftKey));
    const link = event.target instanceof Element ? event.target.closest('a[href^="#/"]') : null;
    if (!isNewTabClick || !link) return;
    event.preventDefault();
    try {
      const url = await anilistUrlForPath(link.getAttribute('href')?.slice(1) ?? '');
      if (url) await invoke('shell.openUrl', { url });
    } catch (error) {
      toasts.error(error, 'Impossible d’ouvrir la page AniList');
    }
  }

  onMount(() => {
    document.addEventListener('auxclick', openLinkOnAniList);
    document.addEventListener('click', openLinkOnAniList);
    playback.init();
    liveAbout.init();
    void session.init();
    void updates.check();
    // <-- Avant de quitter : le profil repasse au repos, puis le host peut fermer -->
    on('window.closing', async () => {
      await liveAbout.publishIdle();
      await invoke('window.readyToQuit');
    });
    const uninstallSparkles = installSparkles();
    const uninstallSpoilers = installSpoilers();
    return () => {
      document.removeEventListener('auxclick', openLinkOnAniList);
      document.removeEventListener('click', openLinkOnAniList);
      uninstallSparkles();
      uninstallSpoilers();
    };
  });

  // <-- Chargement de la liste et de la bibliothèque une fois connecté (hors suivi, sinon l'effet boucle) -->
  $effect(() => {
    if (session.status !== 'ready') return;
    untrack(() => {
      mediaList.load('ANIME').catch((error) => toasts.error(error, 'Impossible de charger ta liste d’anime'));
      void library.refresh();
    });
  });
</script>

<Backdrop />

<div class="window">
  <TitleBar hasSpine={session.status === 'ready'} />

  <div class="content">
    {#if session.status === 'loading'}
      <LoadingState label="On ouvre le carnet…" />
    {:else if session.status === 'error'}
      <EmptyState title="Ruruka n’a pas pu démarrer" message={session.error ?? undefined} />
    {:else if session.status === 'setup'}
      <SetupPage />
    {:else}
      <div class="shell">
        <Sidebar />
        <main>
          {#if match}
            {#key match.path}
              {#await match.route.load()}
                <LoadingState />
              {:then page}
                <div in:fly={pageEnter}>
                  <page.default params={match.params} />
                </div>
              {:catch error}
                <EmptyState title="Cette page n’a pas pu se charger" message={String(error)} />
              {/await}
            {/key}
          {:else}
            <EmptyState title="Affaire classée… rien ici" message="Cette page n’existe pas." />
          {/if}
        </main>
      </div>
      <SkipWarningDialog />
    {/if}
  </div>
</div>

<UpdateDialog />
<Toasts />

<style>
  .window {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .content {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .shell {
    display: grid;
    grid-template-columns: var(--sidebarWidth) minmax(0, 1fr);
    height: 100%;
  }

  main {
    overflow-y: auto;
  }
</style>
