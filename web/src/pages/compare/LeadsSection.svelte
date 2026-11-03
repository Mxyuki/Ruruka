<script lang="ts">
  import type { ComparisonEntry } from '../../api/queries/list';
  import type { MediaType } from '../../api/types';
  import MediaCard from '../../components/MediaCard.svelte';
  import Section from '../../components/Section.svelte';
  import { formatScoreOutOf } from '../../lib/format';
  import { session } from '../../state/session.svelte';
  import LeadFilterBar from './LeadFilterBar.svelte';
  import { defaultMinScore, leadsFor, sharedLeads, type Lead, type LeadFilters, type LeadMode } from './leads';
  import type { TasteProfile } from './tastes';

  interface Props {
    mine: ComparisonEntry[];
    theirs: ComparisonEntry[];
    myTastes: TasteProfile;
    theirTastes: TasteProfile;
    otherName: string;
    type: MediaType;
  }

  let { mine, theirs, myTastes, theirTastes, otherName, type }: Props = $props();

  const pageSize = 48;
  let mode = $state<LeadMode>('mine');
  let shownCount = $state(pageSize);
  let filters = $state<LeadFilters>({ genres: [], tags: [], minScore: defaultMinScore(session.scoreFormat), includesPlanned: true, sort: 'match' });

  const modes = $derived<[LeadMode, string][]>([
    ['mine', `Mes coups de cœur que ${otherName} n’a pas vus`],
    ['theirs', `Ceux de ${otherName} que je n’ai pas vus`],
    ['shared', 'Nos coups de cœur communs'],
  ]);
  const leads = $derived.by(() => {
    if (mode === 'shared') return sharedLeads(mine, theirs, filters);
    return mode === 'mine' ? leadsFor(mine, theirs, theirTastes, filters) : leadsFor(theirs, mine, myTastes, filters);
  });
  const genres = $derived([...new Set([...mine, ...theirs].flatMap((entry) => entry.media.genres))].sort((a, b) => a.localeCompare(b)));
  const word = $derived(type === 'MANGA' ? 'manga' : 'anime');

  // <-- Chaque nouveau tri ou filtre repart de la première page de pistes -->
  $effect.pre(() => {
    void leads;
    shownCount = pageSize;
  });

  // <-- Les tris propres à un onglet n'ont pas de sens dans l'autre : on passe sur celui qui y correspond -->
  function chooseMode(next: LeadMode) {
    mode = next;
    if (next === 'shared' && (filters.sort === 'match' || filters.sort === 'score')) filters.sort = 'harmony';
    if (next !== 'shared' && filters.sort === 'harmony') filters.sort = 'match';
  }

  const scoreLabel = (score: number) => (score ? formatScoreOutOf(score, session.scoreFormat) : '–');

  function subtitleFor(lead: Lead): string {
    if (lead.otherEntry) return `Moi ${scoreLabel(lead.entry.score)} · ${otherName} ${scoreLabel(lead.otherEntry.score)}`;
    const score = lead.entry.score ? `${mode === 'mine' ? 'Ma note' : 'Sa note'} : ${scoreLabel(lead.entry.score)}` : 'Pas noté';
    return lead.isPlannedByOther ? `${score} · déjà « À voir »` : score;
  }
</script>

<Section title="Pistes à se transmettre">
  <div class="directions" role="tablist">
    {#each modes as [value, label] (value)}
      <button class="chip" class:is-active={mode === value} type="button" role="tab" aria-selected={mode === value} onclick={() => chooseMode(value)}>
        {label}
      </button>
    {/each}
  </div>

  <LeadFilterBar bind:filters {genres} {mode} {otherName} />

  {#if leads.length}
    <p class="faint count">{leads.length} {word} {mode === 'shared' ? 'aimés par vous deux' : 'à proposer'}</p>
    <div class="media-grid">
      {#each leads.slice(0, shownCount) as lead (lead.entry.mediaId)}
        <MediaCard media={lead.entry.media} subtitle={subtitleFor(lead)} />
      {/each}
    </div>
    {#if shownCount < leads.length}
      <button class="btn btn-ghost more" type="button" onclick={() => (shownCount += pageSize)}>Voir plus de pistes</button>
    {/if}
  {:else}
    <p class="faint">Aucune piste avec ces filtres. Essaie d’assouplir la note minimale ou de retirer un genre.</p>
  {/if}
</Section>

<style>
  .directions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    margin-bottom: var(--space4);
  }

  .count {
    margin-bottom: var(--space4);
  }

  .more {
    width: 100%;
    margin-top: var(--space5);
  }
</style>
