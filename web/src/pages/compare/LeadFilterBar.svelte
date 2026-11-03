<script lang="ts">
  import { fetchTagGroups } from '../../api/queries/search';
  import FilterCombobox from '../../components/FilterCombobox.svelte';
  import PickedFilters from '../../components/PickedFilters.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import { togglePick } from '../../lib/filterPicks';
  import { session } from '../../state/session.svelte';
  import type { MediaFormat, MediaType } from '../../api/types';
  import { formatEnum } from '../../lib/format';
  import { scoreThresholds, type LeadFilters, type LeadMode, type LeadSort } from './leads';

  interface Props {
    filters: LeadFilters;
    /** Every genre found in either list. */
    genres: string[];
    mode: LeadMode;
    otherName: string;
    type: MediaType;
  }

  let { filters = $bindable(), genres, mode, otherName, type }: Props = $props();

  const formatsByType: Record<MediaType, MediaFormat[]> = {
    ANIME: ['TV', 'TV_SHORT', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC'],
    MANGA: ['MANGA', 'NOVEL', 'ONE_SHOT'],
  };
  const unitsLabel = $derived(type === 'MANGA' ? 'Chapitres' : 'Épisodes');

  // <-- Aucun format coché veut dire tous ; cocher en garde seulement ceux-là -->
  function toggleFormat(format: MediaFormat) {
    filters.formats = filters.formats.includes(format) ? filters.formats.filter((kept) => kept !== format) : [...filters.formats, format];
  }

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

<div class="second-row">
  <div class="formats">
    <span class="field-label">Formats</span>
    <button class="chip" class:is-active={!filters.formats.length} type="button" onclick={() => (filters.formats = [])}>Tous</button>
    {#each formatsByType[type] as format (format)}
      <button class="chip" class:is-active={filters.formats.includes(format)} type="button" aria-pressed={filters.formats.includes(format)} onclick={() => toggleFormat(format)}>
        {formatEnum(format)}
      </button>
    {/each}
  </div>
  <div class="units">
    <span class="field-label">{unitsLabel}</span>
    <input class="input" type="number" min="1" placeholder="min" aria-label="{unitsLabel} au minimum" bind:value={filters.minUnits} />
    <span class="faint">à</span>
    <input class="input" type="number" min="1" placeholder="max" aria-label="{unitsLabel} au maximum" bind:value={filters.maxUnits} />
  </div>
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

  .second-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space3) var(--space5);
    margin-bottom: var(--space4);
  }

  .formats,
  .units {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .formats .field-label,
  .units .field-label {
    margin: 0 var(--space1) 0 0;
  }

  .units .input {
    width: 90px;
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
