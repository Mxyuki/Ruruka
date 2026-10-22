<script lang="ts">
  import { listStatuses, type ListEntry, type MediaListStatus, type MediaSummary, type MediaType } from '../../api/types';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import ListEditor from '../../components/ListEditor.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { formatListStatus, statusColor } from '../../lib/format';
  import type { RouteParams } from '../../lib/router.svelte';
  import { normalizeForMatch } from '../../lib/titleMatch';
  import { mediaList } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import ListRow from './ListRow.svelte';

  type SortKey = 'updated' | 'title' | 'score' | 'progress';
  type ViewMode = 'rows' | 'grid';

  let { params }: { params: RouteParams } = $props();

  const type: MediaType = $derived(params.type === 'manga' ? 'MANGA' : 'ANIME');
  // <-- Onglet actif : tout, un statut, ou une liste perso (préfixée « list: ») -->
  let activeStatus = $state<MediaListStatus | 'ALL' | `list:${string}`>('CURRENT');
  let filter = $state('');
  let sortKey = $state<SortKey>('updated');
  let viewMode = $state<ViewMode>('rows');
  let editing = $state<MediaSummary | null>(null);

  $effect(() => {
    mediaList.load(type).catch((error) => toasts.error(error, 'Impossible de charger ta liste'));
  });

  const allEntries = $derived(mediaList.list(type));
  const customLists = $derived(session.customListNames(type));
  const isInList = (entry: ListEntry, name: string) => Boolean(entry.customLists?.some((list) => list.name === name && list.enabled));
  const listCounts = $derived(Object.fromEntries(customLists.map((name) => [name, allEntries.filter((entry) => isInList(entry, name)).length])));

  function matchesTab(entry: ListEntry): boolean {
    if (activeStatus === 'ALL') return true;
    if (activeStatus.startsWith('list:')) return isInList(entry, activeStatus.slice('list:'.length));
    return entry.status === activeStatus;
  }

  const counts = $derived(
    Object.fromEntries(listStatuses.map((status) => [status, allEntries.filter((entry) => entry.status === status).length])),
  );

  const sorters: Record<SortKey, (a: ListEntry, b: ListEntry) => number> = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    title: (a, b) => a.media.title.userPreferred.localeCompare(b.media.title.userPreferred),
    score: (a, b) => b.score - a.score,
    progress: (a, b) => b.progress - a.progress,
  };

  const visibleEntries = $derived.by(() => {
    const query = normalizeForMatch(filter);
    return allEntries
      .filter((entry) => matchesTab(entry))
      .filter((entry) => !query || normalizeForMatch(entry.media.title.userPreferred).includes(query))
      .sort(sorters[sortKey]);
  });
</script>

<div class="page">
  <PageHeader
    title="Mes {type === 'ANIME' ? 'anime' : 'manga'}"
    note={mediaList.isLoaded(type) ? `${allEntries.length} dossiers · ${counts.CURRENT ?? 0} en cours · ${counts.COMPLETED ?? 0} résolus` : undefined}
  />

  <div class="toolbar">
    <div class="tabs" role="tablist">
      <button class="chip" class:is-active={activeStatus === 'ALL'} type="button" onclick={() => (activeStatus = 'ALL')}>
        Tout <span class="count">{allEntries.length}</span>
      </button>
      {#each listStatuses as status (status)}
        {#if counts[status]}
          <button class="chip" class:is-active={activeStatus === status} type="button" onclick={() => (activeStatus = status)}>
            <span class="dot" style:background={statusColor(status)}></span>
            {formatListStatus(status, type)} <span class="count">{counts[status]}</span>
          </button>
        {/if}
      {/each}
      {#each customLists as name (name)}
        <button class="chip is-list" class:is-active={activeStatus === `list:${name}`} type="button" onclick={() => (activeStatus = `list:${name}`)}>
          {name} <span class="count">{listCounts[name] ?? 0}</span>
        </button>
      {/each}
    </div>

    <div class="controls">
      <input class="input" type="search" placeholder="Chercher un titre" bind:value={filter} />
      <select class="select" bind:value={sortKey} aria-label="Trier">
        <option value="updated">Derniers modifiés</option>
        <option value="title">Titre</option>
        <option value="score">Note</option>
        <option value="progress">Progression</option>
      </select>
      <button class="btn btn-ghost" type="button" aria-label="Changer l'affichage" title="Changer l'affichage" onclick={() => (viewMode = viewMode === 'rows' ? 'grid' : 'rows')}>
        <Icon name={viewMode === 'rows' ? 'grid' : 'rows'} />
      </button>
    </div>
  </div>

  {#if !mediaList.isLoaded(type)}
    <LoadingState />
  {:else if !visibleEntries.length}
    <EmptyState title="Aucun dossier ici" message={filter ? 'Rien ne correspond à ta recherche.' : 'Cette partie de ta liste est vide.'} />
  {:else if viewMode === 'rows'}
    <div class="rows">
      {#each visibleEntries as entry (entry.id)}
        <ListRow {entry} onedit={() => (editing = entry.media)} />
      {/each}
    </div>
  {:else}
    <div class="media-grid">
      {#each visibleEntries as entry (entry.id)}
        <MediaCard media={entry.media}>
          {#snippet overlay()}{entry.progress}{entry.media.episodes ?? entry.media.chapters ? ` / ${entry.media.episodes ?? entry.media.chapters}` : ''}{/snippet}
        </MediaCard>
      {/each}
    </div>
  {/if}
</div>

{#if editing}
  <ListEditor media={editing} open onclose={() => (editing = null)} />
{/if}

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space3);
    margin-bottom: var(--space4);
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .chip {
    border: 0;
    cursor: pointer;
  }

  .chip.is-list {
    border-style: dashed;
  }

  .count {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .controls {
    display: flex;
    gap: var(--space2);
  }

  .controls .input {
    width: 220px;
  }

  .controls .select {
    width: 150px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
  }
</style>
