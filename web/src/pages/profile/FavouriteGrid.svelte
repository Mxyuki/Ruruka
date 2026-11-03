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

  let grid = $state<HTMLElement>();
  let width = $state(0);
  const columnGapPx = $derived(width && grid ? parseFloat(getComputedStyle(grid).columnGap) || 0 : 0);

  // <-- Autant de colonnes que la largeur permet, puis des rangées égales : 25 favoris font 9 + 9 + 7, jamais 11 + 11 + 3 -->
  const columns = $derived.by(() => {
    if (!width) return Math.min(items.length, 6);
    const maxColumns = Math.max(1, Math.floor((width + columnGapPx) / (minItemWidth + columnGapPx)));
    const rows = Math.ceil(items.length / maxColumns);
    return Math.ceil(items.length / rows);
  });
</script>

<div class="grid" bind:this={grid} bind:clientWidth={width} style:--columns={columns} style:--columnGap={columnGap} style:--rowGap={rowGap}>
  {#each items as item (keyOf(item))}
    <div class="cell">{@render cell(item)}</div>
  {/each}
</div>

<style>
  /* <-- La dernière rangée, plus courte, se centre sous les autres --> */
  .grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--rowGap) var(--columnGap);
  }

  .cell {
    display: flex;
    width: calc((100% - (var(--columns) - 1) * var(--columnGap)) / var(--columns));
    min-width: 0;
  }

  .cell > :global(*) {
    flex: 1;
    min-width: 0;
  }
</style>
