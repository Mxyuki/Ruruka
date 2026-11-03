<script lang="ts">
  import { fetchTagGroups } from '../../api/queries/search';
  import FilterCombobox from '../../components/FilterCombobox.svelte';
  import PickedFilters from '../../components/PickedFilters.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import { togglePick } from '../../lib/filterPicks';
  import { session } from '../../state/session.svelte';
  import { scoreThresholds, type LeadFilters, type LeadMode, type LeadSort } from './leads';

  interface Props {
    filters: LeadFilters;
    /** Every genre found in either list. */
    genres: string[];
    mode: LeadMode;
    otherName: string;
  }

  let { filters = $bindable(), genres, mode, otherName }: Props = $props();

  const thresholds = $derived(scoreThresholds(session.scoreFormat));
  const labels = $derived(
    {
      mine: { score: 'Ma note', match: `Les goûts de ${otherName}`, planned: `Garder ce que ${otherName} a mis « À voir »` },
      theirs: { score: `Note de ${otherName}`, match: 'Mes goûts', planned: 'Garder ce que j’ai mis « À voir »' },
      shared: { score: 'Nos deux notes', match: '', planned: '' },
    }[mode],
  );
  const sorts = $derived<[LeadSort, string][]>(
    mode === 'shared'
      ? [
          ['harmony', 'Aimés tous les deux'],
          ['popularity', 'Popularité'],
        ]
      : [
          ['match', labels.match],
          ['score', labels.score],
          ['popularity', 'Popularité'],
        ],
  );
  const loadGenreGroups = () => Promise.resolve([{ category: '', names: genres }]);
</script>

<div class="filters">
  <FilterCombobox
    label="Genres"
    loadGroups={loadGenreGroups}
    picked={filters.genres.map((pick) => pick.name)}
    onpick={(name) => (filters.genres = togglePick(filters.genres, name))}
  />
  <FilterCombobox label="Mots-clés" loadGroups={fetchTagGroups} picked={filters.tags.map((pick) => pick.name)} onpick={(name) => (filters.tags = togglePick(filters.tags, name))} />
  <label>
    <span class="field-label">{labels.score}</span>
    <select class="select" bind:value={filters.minScore}>
      {#each thresholds as threshold (threshold.value)}<option value={threshold.value}>{threshold.label}</option>{/each}
    </select>
  </label>
  <label>
    <span class="field-label">Trier selon</span>
    <select class="select" bind:value={filters.sort}>
      {#each sorts as [value, label] (value)}<option {value}>{label}</option>{/each}
    </select>
  </label>
  {#if mode !== 'shared'}
    <div class="planned">
      <Toggle checked={filters.includesPlanned} label={labels.planned} onchange={(checked) => (filters.includesPlanned = checked)} />
    </div>
  {/if}
</div>

{#if filters.genres.length || filters.tags.length}
  <div class="picked">
    <PickedFilters label="Genres" bind:picks={filters.genres} />
    <PickedFilters label="Mots-clés" bind:picks={filters.tags} />
    <p class="faint">Clique un filtre pour l’exclure (« Sans… ») ou l’exiger à nouveau.</p>
  </div>
{/if}

<style>
  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    align-items: end;
    gap: var(--space3);
    margin-bottom: var(--space4);
  }

  .planned {
    padding-bottom: 6px;
  }

  .picked {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
    margin-bottom: var(--space4);
  }
</style>
