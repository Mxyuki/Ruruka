<script lang="ts">
  import { fetchComparisonList, forgetComparisonLists } from '../../api/queries/list';
  import { fetchUserProfile } from '../../api/queries/user';
  import type { MediaType } from '../../api/types';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { formatRelativeTime } from '../../lib/format';
  import type { RouteParams } from '../../lib/router.svelte';
  import { userPath } from '../../lib/routes';
  import { session } from '../../state/session.svelte';
  import AffinityCard from './AffinityCard.svelte';
  import LeadsSection from './LeadsSection.svelte';
  import SharedTastes from './SharedTastes.svelte';
  import { affinityOf, tasteProfile } from './tastes';

  let { params }: { params: RouteParams } = $props();

  const name = $derived(params.name ?? '');
  let type = $state<MediaType>('ANIME');
  const types: [MediaType, string][] = [
    ['ANIME', 'Anime'],
    ['MANGA', 'Manga'],
  ];

  let reloadCount = $state(0);
  const cacheMinutes = $derived(session.settings?.compareCacheMinutes ?? 10);

  // <-- Les deux listes complètes, genres et mots-clés compris, gardées en mémoire le temps choisi dans les réglages ; tout se calcule ici sans autre requête -->
  const comparison = $derived.by(() => {
    void reloadCount;
    return Promise.all([
      fetchUserProfile(name),
      fetchComparisonList(session.viewer?.name ?? '', type, session.scoreFormat, cacheMinutes),
      fetchComparisonList(name, type, session.scoreFormat, cacheMinutes),
    ]).then(([user, mine, theirs]) => ({
      user,
      mine: mine.entries,
      theirs: theirs.entries,
      loadedAt: Math.min(mine.loadedAt, theirs.loadedAt),
      affinity: affinityOf(mine.entries, theirs.entries),
      myTastes: tasteProfile(mine.entries),
      theirTastes: tasteProfile(theirs.entries),
    }));
  });

  function reload() {
    forgetComparisonLists();
    reloadCount++;
  }
</script>

<div class="page">
  <PageHeader title="Confrontation des carnets" note="Toi et {name}, indice par indice">
    {#snippet actions()}
      <div class="types" role="tablist">
        {#each types as [value, label] (value)}
          <button class="chip" class:is-active={type === value} type="button" role="tab" aria-selected={type === value} onclick={() => (type = value)}>
            {label}
          </button>
        {/each}
        <button class="btn btn-sm" type="button" title="Redemander les deux listes à AniList, même si elles sont encore en mémoire" onclick={reload}>
          <Icon name="refresh" size={14} /> Relever à nouveau
        </button>
        <a class="btn btn-sm btn-ghost" href="#{userPath(name)}">Retour au profil</a>
      </div>
    {/snippet}
  </PageHeader>

  {#await comparison}
    <LoadingState />
  {:then { user, mine, theirs, loadedAt, affinity, myTastes, theirTastes }}
    <p class="freshness faint">Carnets relevés {formatRelativeTime(loadedAt / 1000)}</p>
    {#if session.viewer}
      <AffinityCard viewer={session.viewer} other={user} {affinity} {type} />
    {/if}
    <SharedTastes {myTastes} {theirTastes} otherName={user.name} {type} />
    <LeadsSection {mine} {theirs} {myTastes} {theirTastes} otherName={user.name} {type} />
  {:catch error}
    <EmptyState title="Carnet inaccessible" message={error.message} />
  {/await}
</div>

<style>
  .freshness {
    margin: calc(var(--space4) * -1) 0 var(--space4);
    font-size: var(--fontSizeSm);
    text-align: right;
  }

  .types {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }
</style>
