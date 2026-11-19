<script lang="ts">
  import { tick } from 'svelte';
  import { fetchListTraits, type ListTraits } from '../../api/queries/list';
  import { fetchGenres, fetchTagGroups, type BrowseFilters, type BrowseMedia, type MediaSort } from '../../api/queries/search';
  import type { MediaFormat, MediaSeason, MediaStatus, MediaType } from '../../api/types';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { formatEnum } from '../../lib/format';
  import { fullRowCount, trackColumns } from '../../lib/gridColumns';
  import { navigate, replaceQuery, router, type RouteParams } from '../../lib/router.svelte';
  import { mediaList } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import FilterCombobox from '../../components/FilterCombobox.svelte';
  import {
    defaultTagRank,
    excludedNames,
    needsStatusCheck,
    onListFor,
    ownListStatuses,
    requiredNames,
    togglePick,
    updatePick,
  } from '../../lib/filterPicks';
  import ListStatusFilter from './ListStatusFilter.svelte';
  import { browseOwnList } from './localBrowse';
  import { defaultSort, readSearchState, writeSearchState } from './searchQuery';
  import { SearchResults } from './searchResults.svelte';
  import PickedFilters from '../../components/PickedFilters.svelte';
  import TagRankDialog from './TagRankDialog.svelte';

  let { params }: { params: RouteParams } = $props();

  const searchDelayMs = 400;
  const localPageSize = 30;
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
  // <-- Les filtres vivent dans l'adresse : revenir en arrière depuis un anime retrouve la même recherche -->
  const initial = readSearchState(router.query());

  let search = $state(initial.search);
  let genrePicks = $state(initial.genrePicks);
  let tagPicks = $state(initial.tagPicks);
  let isTagRankOpen = $state(false);
  let listChoices = $state(initial.listChoices);
  const requiredTagPicks = $derived(tagPicks.filter((pick) => !pick.isExcluded));
  let year = $state(initial.year);
  let season = $state(initial.season);
  let format = $state(initial.format);
  let status = $state(initial.status);
  let sort = $state(initial.sort);

  const loadGenreGroups = async () => [{ category: '', names: await fetchGenres() }];

  let debouncedSearch = $state(initial.search);
  let searchTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const value = search;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => (debouncedSearch = value), searchDelayMs);
  });

  const filters: BrowseFilters = $derived({
    type,
    search: debouncedSearch.trim() || undefined,
    genres: requiredNames(genrePicks),
    excludedGenres: excludedNames(genrePicks),
    tags: requiredTagPicks.map((pick) => ({ name: pick.name, minimumRank: pick.minimumRank ?? defaultTagRank })),
    excludedTags: excludedNames(tagPicks),
    year: Number(year) || undefined,
    season,
    formats: format ? [format] : undefined,
    status,
    onList: onListFor(listChoices),
    sort,
  });

  // <-- AniList ne sait filtrer que « dans ta liste ou non » : les statuts se vérifient ici, sur ta liste chargée -->
  const keep = $derived.by(() => {
    if (!needsStatusCheck(listChoices)) return undefined;
    const wanted = new Set(listChoices);
    return (media: BrowseMedia) => wanted.has(mediaList.entryFor(media.id)?.status ?? 'NONE');
  });

  $effect(() => {
    mediaList.load(type).catch((error) => toasts.error(error, 'Impossible de charger ta liste'));
  });

  const results = new SearchResults();

  // <-- Un statut de ta liste se lit dans ta liste : genres, tags et popularité arrivent en un seul appel, sans parcourir les pages d'Explorer -->
  const ownStatuses = $derived(ownListStatuses(listChoices));
  let ownTraits = $state.raw<Map<number, ListTraits> | null>(null);
  let localLimit = $state(localPageSize);
  let columns = $state(1);

  $effect(() => {
    const viewerId = session.viewer?.id;
    if (!ownStatuses || !viewerId || !mediaList.isLoaded(type)) return;
    let isCurrent = true;
    fetchListTraits(viewerId, type, mediaList.list(type).length)
      .then((traits) => {
        if (isCurrent) ownTraits = traits;
      })
      .catch((error) => toasts.error(error, 'Impossible de lire les détails de ta liste'));
    return () => {
      isCurrent = false;
    };
  });

  const ownMedia = $derived(ownStatuses && ownTraits ? browseOwnList(mediaList.list(type), ownTraits, ownStatuses, filters) : null);

  $effect(() => {
    void filters;
    void ownStatuses;
    localLimit = localPageSize;
  });

  // <-- La dernière ligne reste pleine : sur un grand écran, les cartes en trop attendent le prochain chargement -->
  const loadedMedia = $derived(ownMedia ? ownMedia.slice(0, localLimit) : (results.result?.media ?? []));
  const canLoadMore = $derived(ownMedia ? localLimit < ownMedia.length : Boolean(results.result?.pageInfo.hasNextPage));
  const visibleMedia = $derived(loadedMedia.slice(0, fullRowCount(loadedMedia.length, columns, canLoadMore)));

  $effect(() => {
    const page = results.result?.pageInfo.currentPage ?? 1;
    replaceQuery(writeSearchState({ search: debouncedSearch.trim(), genrePicks, tagPicks, year, season, format, status, sort, listChoices, page }));
  });

  // <-- Au retour sur Explorer, on recharge les pages déjà vues puis on reprend le défilement là où il était -->
  let pageToRestore = initial.page;
  let scrollToRestore = router.savedScroll();

  $effect(() => {
    const current = filters;
    const keepTest = keep;
    if (ownStatuses) return;
    if (keepTest && !mediaList.isLoaded(type)) return;
    const lastPage = pageToRestore;
    pageToRestore = 1;
    results.search(current, keepTest, lastPage).then(async (isShown) => {
      if (!isShown || !scrollToRestore) return;
      await tick();
      document.querySelector('main')?.scrollTo({ top: scrollToRestore });
      scrollToRestore = 0;
    });
  });

  function loadMore() {
    if (ownStatuses) localLimit += localPageSize;
    else void results.loadMore(filters, keep);
  }

  function clearFilters() {
    search = year = '';
    genrePicks = [];
    tagPicks = [];
    listChoices = [];
    season = format = status = undefined;
    sort = defaultSort;
  }
</script>

{#snippet tagRankButton()}
  <button
    class="btn btn-ghost btn-sm btn-icon"
    type="button"
    title="Pourcentage minimum de chaque mot-clé"
    aria-label="Pourcentage minimum de chaque mot-clé"
    disabled={!requiredTagPicks.length}
    onclick={() => (isTagRankOpen = true)}
  >
    <Icon name="settings" size={14} />
  </button>
{/snippet}

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
    <FilterCombobox label="Genres" loadGroups={loadGenreGroups} picked={genrePicks.map((pick) => pick.name)} onpick={(name) => (genrePicks = togglePick(genrePicks, name))} />
    <FilterCombobox
      label="Mots-clés"
      loadGroups={fetchTagGroups}
      picked={tagPicks.map((pick) => pick.name)}
      onpick={(name) => (tagPicks = togglePick(tagPicks, name, defaultTagRank))}
      labelAction={tagRankButton}
    />
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
      <select class="select" bind:value={sort} disabled={Boolean(filters.search) && !ownStatuses}>
        {#each sorts as [value, label] (value)}<option {value}>{label}</option>{/each}
      </select>
    </label>
  </div>

  <ListStatusFilter {type} bind:choices={listChoices} />

  {#if genrePicks.length || tagPicks.length}
    <div class="picked">
      <PickedFilters label="Genres" bind:picks={genrePicks} />
      <PickedFilters label="Mots-clés" bind:picks={tagPicks} />
      <p class="faint">Clique un filtre pour l’exclure ou l’exiger à nouveau.</p>
    </div>
  {/if}

  {#if ownStatuses ? !ownMedia : results.isLoading && !results.result}
    <LoadingState />
  {:else if visibleMedia.length}
    <div class="media-grid" class:is-stale={!ownStatuses && results.isLoading} use:trackColumns={(count) => (columns = count)}>
      {#each visibleMedia as media (media.id)}
        <MediaCard {media} hasStatusLabel subtitle={[media.seasonYear, formatEnum(media.format)].filter(Boolean).join(' · ')} />
      {/each}
    </div>
    {#if canLoadMore}
      <div class="more">
        <button class="btn" type="button" disabled={results.isLoadingMore} onclick={loadMore}>
          {results.isLoadingMore ? 'Chargement…' : 'Voir plus'}
        </button>
      </div>
    {/if}
  {:else if ownMedia || results.result}
    <EmptyState title="Aucun suspect trouvé" message="Rien ne correspond à ces filtres.">
      <button class="btn" type="button" onclick={clearFilters}>Effacer les filtres</button>
    </EmptyState>
  {/if}
</div>

<TagRankDialog
  open={isTagRankOpen}
  picks={requiredTagPicks}
  onrank={(name, minimumRank) => (tagPicks = updatePick(tagPicks, name, { minimumRank }))}
  onclose={() => (isTagRankOpen = false)}
/>

<style>
  .type-switch {
    display: flex;
    gap: var(--space2);
  }

  .type-switch .chip {
    border: 0;
    cursor: pointer;
  }

  .picked {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
    margin: calc(var(--space2) * -1) 0 var(--space5);
  }

  .picked .faint {
    font-size: var(--fontSizeXs);
  }

  .filters {
    display: grid;
    grid-template-columns: minmax(200px, 2fr) repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space3);
    margin-bottom: var(--space5);
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
