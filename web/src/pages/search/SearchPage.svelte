<script lang="ts">
  import { browseMedia, fetchGenres, type BrowseFilters, type BrowseResult, type MediaSort } from '../../api/queries/search';
  import type { MediaFormat, MediaSeason, MediaStatus, MediaType } from '../../api/types';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { formatEnum } from '../../lib/format';
  import { navigate, router, type RouteParams } from '../../lib/router.svelte';
  import { toasts } from '../../state/toasts.svelte';

  let { params }: { params: RouteParams } = $props();

  const searchDelayMs = 400;
  const seasons: MediaSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const statuses: MediaStatus[] = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'HIATUS', 'CANCELLED'];
  const formats: Record<MediaType, MediaFormat[]> = {
    ANIME: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'],
    MANGA: ['MANGA', 'NOVEL', 'ONE_SHOT'],
  };
  const sorts: [MediaSort, string][] = [
    ['TRENDING_DESC', 'Tendances'],
    ['POPULARITY_DESC', 'Popularité'],
    ['SCORE_DESC', 'Note moyenne'],
    ['FAVOURITES_DESC', 'Favoris'],
    ['START_DATE_DESC', 'Plus récents'],
    ['TITLE_ROMAJI', 'Titre'],
  ];

  const type: MediaType = $derived(params.type === 'manga' ? 'MANGA' : 'ANIME');
  const query = router.query();
  const optional = <T extends string>(key: string) => (query.get(key) as T | null) ?? undefined;

  let search = $state(query.get('q') ?? '');
  let genre = $state(query.get('genre') ?? '');
  let tag = $state(query.get('tag') ?? '');
  let year = $state(query.get('year') ?? '');
  let season = $state<MediaSeason | undefined>(optional('season'));
  let format = $state<MediaFormat | undefined>(optional('format'));
  let status = $state<MediaStatus | undefined>(optional('status'));
  let sort = $state<MediaSort>(optional<MediaSort>('sort') ?? 'POPULARITY_DESC');

  let debouncedSearch = $state(query.get('q') ?? '');
  let searchTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const value = search;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => (debouncedSearch = value), searchDelayMs);
  });

  const filters: BrowseFilters = $derived({
    type,
    search: debouncedSearch.trim() || undefined,
    genres: genre ? [genre] : undefined,
    tags: tag ? [tag] : undefined,
    year: Number(year) || undefined,
    season,
    formats: format ? [format] : undefined,
    status,
    sort,
  });

  let result = $state<BrowseResult | null>(null);
  let isLoading = $state(false);
  let isLoadingMore = $state(false);

  $effect(() => {
    const current = filters;
    isLoading = true;
    browseMedia(current)
      .then((page) => {
        if (current === filters) result = page;
      })
      .catch((error) => toasts.error(error, 'La recherche a échoué'))
      .finally(() => (isLoading = false));
  });

  async function loadMore() {
    if (!result) return;
    isLoadingMore = true;
    try {
      const next = await browseMedia(filters, result.pageInfo.currentPage + 1);
      // <-- Les classements bougent entre deux pages : on retire les doublons -->
      const seen = new Set(result.media.map((media) => media.id));
      result = { pageInfo: next.pageInfo, media: [...result.media, ...next.media.filter((media) => !seen.has(media.id))] };
    } catch (error) {
      toasts.error(error, 'Impossible de charger la suite');
    } finally {
      isLoadingMore = false;
    }
  }

  function clearFilters() {
    search = genre = tag = year = '';
    season = format = status = undefined;
    sort = 'POPULARITY_DESC';
  }
</script>

<div class="page">
  <PageHeader title="Explorer" note="À la recherche de nouvelles affaires">
    {#snippet actions()}
      <div class="type-switch">
        <button class="chip" class:is-active={type === 'ANIME'} type="button" onclick={() => navigate('/search/anime')}>Anime</button>
        <button class="chip" class:is-active={type === 'MANGA'} type="button" onclick={() => navigate('/search/manga')}>Manga</button>
      </div>
    {/snippet}
  </PageHeader>

  <div class="filters">
    <label class="search-field">
      <span class="field-label">Recherche</span>
      <input class="input" type="search" placeholder="Un titre…" bind:value={search} />
    </label>
    <label>
      <span class="field-label">Genre</span>
      <select class="select" bind:value={genre}>
        <option value="">Tous</option>
        {#await fetchGenres() then genres}
          {#each genres as name (name)}<option value={name}>{name}</option>{/each}
        {/await}
      </select>
    </label>
    <label>
      <span class="field-label">Année</span>
      <input class="input" type="number" min="1940" max="2100" placeholder="Toutes" bind:value={year} />
    </label>
    {#if type === 'ANIME'}
      <label>
        <span class="field-label">Saison</span>
        <select class="select" bind:value={season}>
          <option value={undefined}>Tous</option>
          {#each seasons as option (option)}<option value={option}>{formatEnum(option)}</option>{/each}
        </select>
      </label>
    {/if}
    <label>
      <span class="field-label">Format</span>
      <select class="select" bind:value={format}>
        <option value={undefined}>Tous</option>
        {#each formats[type] as option (option)}<option value={option}>{formatEnum(option)}</option>{/each}
      </select>
    </label>
    <label>
      <span class="field-label">Statut</span>
      <select class="select" bind:value={status}>
        <option value={undefined}>Tous</option>
        {#each statuses as option (option)}<option value={option}>{formatEnum(option)}</option>{/each}
      </select>
    </label>
    <label>
      <span class="field-label">Trier par</span>
      <select class="select" bind:value={sort} disabled={Boolean(filters.search)}>
        {#each sorts as [value, label] (value)}<option {value}>{label}</option>{/each}
      </select>
    </label>
  </div>

  {#if tag}
    <div class="active-tag">
      <span class="chip is-active">Mot-clé : {tag}</span>
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => (tag = '')}>Retirer</button>
    </div>
  {/if}

  {#if isLoading && !result}
    <LoadingState />
  {:else if result && result.media.length}
    <div class="media-grid" class:is-stale={isLoading}>
      {#each result.media as media (media.id)}
        <MediaCard {media} subtitle={[media.seasonYear, formatEnum(media.format)].filter(Boolean).join(' · ')} />
      {/each}
    </div>
    {#if result.pageInfo.hasNextPage}
      <div class="more">
        <button class="btn" type="button" disabled={isLoadingMore} onclick={loadMore}>{isLoadingMore ? 'Chargement…' : 'Voir plus'}</button>
      </div>
    {/if}
  {:else if result}
    <EmptyState title="Aucun suspect trouvé" message="Rien ne correspond à ces filtres.">
      <button class="btn" type="button" onclick={clearFilters}>Effacer les filtres</button>
    </EmptyState>
  {/if}
</div>

<style>
  .type-switch {
    display: flex;
    gap: var(--space2);
  }

  .type-switch .chip {
    border: 0;
    cursor: pointer;
  }

  .filters {
    display: grid;
    grid-template-columns: minmax(200px, 2fr) repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space3);
    margin-bottom: var(--space5);
  }

  .active-tag {
    display: flex;
    align-items: center;
    gap: var(--space2);
    margin: calc(var(--space2) * -1) 0 var(--space4);
  }

  .is-stale {
    opacity: 0.6;
    transition: opacity var(--transitionFast);
  }

  .more {
    display: flex;
    justify-content: center;
    margin-top: var(--space5);
  }
</style>
