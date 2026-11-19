<script lang="ts">
  import ArtSlot from '../../components/ArtSlot.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import CaptureTab from './CaptureTab.svelte';
  import GeneralTab from './GeneralTab.svelte';
  import LibraryTab from './LibraryTab.svelte';
  import PagesTab from './PagesTab.svelte';
  import PlaybackTab from './PlaybackTab.svelte';
  import './settings.css';

  type TabKey = 'general' | 'playback' | 'capture' | 'library' | 'pages';

  const tabs: [TabKey, string][] = [
    ['general', 'Général'],
    ['playback', 'Lecture'],
    ['capture', 'Capture et clips'],
    ['library', 'Bibliothèque'],
    ['pages', 'Pages et profil'],
  ];

  let tab = $state<TabKey>('general');

  async function update(patch: SettingsPatch) {
    try {
      await session.updateSettings(patch);
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer les réglages');
    }
  }
</script>

<div class="page settings">
  <div class="cards">
    <PageHeader title="Réglages" note="Ton carnet, à ta façon" />

    <!-- Un onglet par sujet, pour ne plus faire défiler une longue page -->
    <div class="tabs" role="tablist" aria-label="Catégories de réglages">
      {#each tabs as [key, label] (key)}
        <button class="chip" class:is-active={tab === key} role="tab" aria-selected={tab === key} type="button" onclick={() => (tab = key)}>{label}</button>
      {/each}
    </div>

    {#if tab === 'general'}
      <GeneralTab {update} />
    {:else if tab === 'playback'}
      <PlaybackTab {update} />
    {:else if tab === 'capture'}
      <CaptureTab {update} />
    {:else if tab === 'library'}
      <LibraryTab {update} />
    {:else}
      <PagesTab {update} />
    {/if}
  </div>

  <!-- Ruruka et sa glace tiennent compagnie pendant les réglages -->
  <aside class="companion">
    <ArtSlot name="configuration.png" width={200} height={537} />
  </aside>
</div>

<style>
  .settings {
    display: grid;
    grid-template-columns: minmax(0, 780px) auto;
    align-items: start;
    gap: var(--space7);
  }

  .companion {
    position: sticky;
    top: var(--space6);
    padding-top: var(--space7);
  }

  @media (max-width: 1280px) {
    .settings {
      grid-template-columns: minmax(0, 780px);
    }

    .companion {
      display: none;
    }
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    margin-bottom: var(--space5);
  }

  .tabs .chip {
    border: 0;
    cursor: pointer;
  }
</style>
