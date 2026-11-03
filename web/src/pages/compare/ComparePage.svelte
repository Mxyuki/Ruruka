<script lang="ts">
  import { fetchComparisonList } from '../../api/queries/list';
  import { fetchUserProfile } from '../../api/queries/user';
  import type { MediaType } from '../../api/types';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
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

  // <-- Les deux listes complètes, genres et mots-clés compris, puis tout se calcule ici sans autre requête -->
  const comparison = $derived(
    Promise.all([
      fetchUserProfile(name),
      fetchComparisonList(session.viewer?.name ?? '', type, session.scoreFormat),
      fetchComparisonList(name, type, session.scoreFormat),
    ]).then(([user, mine, theirs]) => ({
      user,
      mine,
      theirs,
      affinity: affinityOf(mine, theirs),
      myTastes: tasteProfile(mine),
      theirTastes: tasteProfile(theirs),
    })),
  );
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
        <a class="btn btn-sm btn-ghost" href="#{userPath(name)}">Retour au profil</a>
      </div>
    {/snippet}
  </PageHeader>

  {#await comparison}
    <LoadingState />
  {:then { user, mine, theirs, affinity, myTastes, theirTastes }}
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
  .types {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }
</style>
