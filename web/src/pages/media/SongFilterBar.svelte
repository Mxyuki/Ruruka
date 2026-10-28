<script lang="ts">
  import type { AnimeSong, SongKind } from '../../api/anisongdb';
  import { emptySongFilters, hasActiveFilters, type SongFilters } from './songFilters';

  interface Props {
    filters: SongFilters;
    songs: AnimeSong[];
    visibleCount: number;
  }

  let { filters = $bindable(), songs, visibleCount }: Props = $props();

  const kindLabels: [SongKind, string][] = [
    ['opening', 'OP'],
    ['ending', 'ED'],
    ['insert', 'Insert'],
  ];
  const countOf = (kind: SongKind) => songs.filter((song) => song.kind === kind).length;
  const textFields = [
    ['name', 'Titre', 'Nom de la chanson'],
    ['artist', 'Artiste', 'Chanteur, chanteuse ou groupe'],
    ['composer', 'Compositeur', 'Qui l’a composée'],
    ['arranger', 'Arrangeur', 'Qui l’a arrangée'],
  ] as const;
</script>

<div class="filters">
  <div class="row">
    {#each kindLabels as [kind, label] (kind)}
      {#if countOf(kind)}
        <button class="chip" class:is-active={filters.kinds[kind]} type="button" aria-pressed={filters.kinds[kind]} onclick={() => (filters.kinds[kind] = !filters.kinds[kind])}>
          {label} <span class="faint">{countOf(kind)}</span>
        </button>
      {/if}
    {/each}
    <span class="count">{visibleCount} / {songs.length}</span>
    {#if hasActiveFilters(filters)}
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => (filters = emptySongFilters())}>Effacer les filtres</button>
    {/if}
  </div>

  <div class="fields">
    {#each textFields as [field, label, placeholder] (field)}
      <label>
        <span>{label}</span>
        <input class="input" type="search" {placeholder} bind:value={filters[field]} />
      </label>
      {#if field === 'artist'}
        <label class="others" title="-1 : peu importe combien d’autres artistes chantent avec. 0 : l’artiste seul·e.">
          <span>Autres artistes max</span>
          <input class="input" type="number" min="-1" step="1" bind:value={filters.maxOtherArtists} disabled={!filters.artist.trim()} />
        </label>
      {/if}
    {/each}
  </div>
  <p class="hint">« Autres artistes max » : -1 garde toutes les chansons où l’artiste chante, même en groupe ; 0 ne garde que ses solos.</p>
</div>

<style>
  .filters {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    padding: var(--space4);
    border-bottom: var(--outlineThin);
    background: var(--colorSunken);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .count {
    margin-left: auto;
    color: var(--textFaint);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space3);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label span {
    font-size: var(--fontSizeXs);
    font-weight: 800;
    text-transform: uppercase;
  }

  .others input:disabled {
    opacity: 0.5;
  }

  .hint {
    color: var(--textFaint);
    font-family: var(--fontHand);
    font-size: var(--fontSizeMd);
  }
</style>
