<script lang="ts">
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LibraryRootPicker from '../../components/LibraryRootPicker.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import type { LibraryFolder } from '../../lib/bridge';
  import { library } from '../../state/library.svelte';
  import { session } from '../../state/session.svelte';
  import FolderRow from './FolderRow.svelte';
  import LinkPicker from './LinkPicker.svelte';

  type Tab = 'attention' | 'linked' | 'ignored';

  let tab = $state<Tab>('attention');
  let picking = $state<LibraryFolder | null>(null);

  const groups = $derived.by(() => {
    const result: Record<Tab, LibraryFolder[]> = { attention: [], linked: [], ignored: [] };
    for (const folder of library.folders) {
      const link = library.linkFor(folder.name);
      if (link?.mediaId) result.linked.push(folder);
      else if (link?.kind === 'manual') result.ignored.push(folder);
      else result.attention.push(folder);
    }
    return result;
  });

  const libraryTabs: [Tab, string][] = [
    ['attention', 'À lier'],
    ['linked', 'Liés'],
    ['ignored', 'Ignorés'],
  ];

  $effect(() => {
    if (tab === 'attention' && !groups.attention.length && groups.linked.length) tab = 'linked';
  });
</script>

<div class="page">
  <PageHeader title="Bibliothèque" note={library.hasRoot ? (session.settings?.libraryRoot ?? undefined) : 'Tes dossiers d’anime téléchargés'}>
    {#snippet actions()}
      {#if library.hasRoot}
        {#if library.status === 'scanning'}
          <span class="faint">Lecture des dossiers…</span>
        {:else if library.status === 'matching'}
          <span class="faint">Recherche des pistes {library.matchProgress.done} / {library.matchProgress.total}…</span>
        {/if}
        <button class="btn" type="button" disabled={library.status !== 'idle'} onclick={() => library.refresh()}>
          <Icon name="refresh" size={14} /> Relire
        </button>
      {/if}
    {/snippet}
  </PageHeader>

  {#if !library.hasRoot}
    <div class="card setup">
      <h2 class="note-label">Choisis ton dossier d’anime</h2>
      <LibraryRootPicker />
    </div>
  {:else if library.status === 'scanning' && !library.folders.length}
    <LoadingState label="Mashutan fouille tes dossiers…" />
  {:else if !library.folders.length}
    <EmptyState title="Aucun dossier d’anime" message="Les sous-dossiers qui contiennent des vidéos apparaîtront ici." />
  {:else}
    <div class="tabs">
      {#each libraryTabs as [value, label] (value)}
        <button class="chip" class:is-active={tab === value} type="button" onclick={() => (tab = value)}>
          {label} <span class="faint">{groups[value].length}</span>
        </button>
      {/each}
    </div>

    {#if groups[tab].length}
      <div class="rows">
        {#each groups[tab] as folder (folder.path)}
          <FolderRow {folder} onpick={() => (picking = folder)} />
        {/each}
      </div>
    {:else}
      <EmptyState title="Rien ici" message={tab === 'attention' ? 'Tous les dossiers sont liés. Affaire résolue !' : undefined} />
    {/if}
  {/if}
</div>

{#if picking}
  <LinkPicker folder={picking} onclose={() => (picking = null)} />
{/if}

<style>
  .setup {
    max-width: 720px;
    padding: var(--space5);
  }

  .tabs {
    display: flex;
    gap: var(--space2);
    margin-bottom: var(--space4);
  }

  .tabs .chip {
    border: 0;
    cursor: pointer;
  }

  .rows {
    overflow: hidden;
  }
</style>
