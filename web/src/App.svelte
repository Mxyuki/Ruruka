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
  import { router } from './lib/router.svelte';
  import { routes } from './lib/routes';
  import { installSparkles } from './lib/sparkle';
  import SetupPage from './pages/setup/SetupPage.svelte';
  import { library } from './state/library.svelte';
  import { mediaList } from './state/mediaList.svelte';
  import { playback } from './state/playback.svelte';
  import { session } from './state/session.svelte';
  import { toasts } from './state/toasts.svelte';

  const match = $derived(router.match(routes));

  const reducesMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pageEnter = { y: 12, duration: reducesMotion ? 0 : 280 };

  onMount(() => {
    playback.init();
    void session.init();
    return installSparkles();
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
