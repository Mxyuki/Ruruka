<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  interface Props {
    items: T[];
    keyOf: (item: T) => number;
    /** Narrowest a cell may get, in CSS pixels. */
    minItemWidth: number;
    /** CSS lengths, usually spacing tokens. */
    columnGap: string;
    rowGap: string;
    cell: Snippet<[T]>;
  }

  let { items, keyOf, minItemWidth, columnGap, rowGap, cell }: Props = $props();

  let frame = $state<HTMLElement>();
  let width = $state(0);
  const columnGapPx = $derived(width && frame ? parseFloat(getComputedStyle(frame).columnGap) || 0 : 0);
  const maxColumns = $derived(width ? Math.max(1, Math.floor((width + columnGapPx) / (minItemWidth + columnGapPx))) : 6);

  // <-- Les cases gardent toujours la taille d'une rangée pleine : un seul favori reste une petite fiche, pas une affiche -->
  const cellWidth = $derived(width ? Math.floor(((width - (maxColumns - 1) * columnGapPx) / maxColumns) * 100) / 100 - 0.01 : minItemWidth);
  // <-- Puis des rangées égales : 25 favoris font 9 + 9 + 7, jamais 11 + 11 + 3 -->
  const columns = $derived(Math.ceil(items.length / Math.ceil(items.length / maxColumns)) || 1);
  const rowWidth = $derived(columns * cellWidth + (columns - 1) * columnGapPx);
</script>

<div class="frame" bind:this={frame} bind:clientWidth={width} style:--columnGap={columnGap}>
  <div class="grid" style:width="{rowWidth}px" style:--cellWidth="{cellWidth}px" style:--rowGap={rowGap}>
    {#each items as item (keyOf(item))}
      <div class="cell">{@render cell(item)}</div>
    {/each}
  </div>
</div>

<style>
  .frame {
    column-gap: var(--columnGap);
  }

  /* <-- La dernière rangée, plus courte, se centre sous les autres --> */
  .grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--rowGap) var(--columnGap);
    max-width: 100%;
  }

  .cell {
    display: flex;
    width: var(--cellWidth);
    min-width: 0;
  }

  .cell > :global(*) {
    flex: 1;
    min-width: 0;
  }
</style>
