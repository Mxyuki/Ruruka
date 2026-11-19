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
    /** Cells can be dragged onto each other to change their place. */
    isReordering?: boolean;
    /** Saves the new order (keys, first shown first); false when it couldn't be saved, and the grid goes back. */
    onreorder?: (keys: number[]) => Promise<boolean>;
  }

  let { items, keyOf, minItemWidth, columnGap, rowGap, cell, isReordering = false, onreorder }: Props = $props();

  // <-- L'ordre choisi vit ici jusqu'à la sortie de la page : AniList l'a déjà, mais le profil chargé ne bouge pas tout seul -->
  let order = $state<number[] | null>(null);
  let draggedKey = $state<number | null>(null);
  let overKey = $state<number | null>(null);

  const shown = $derived.by(() => {
    if (!order) return items;
    const byKey = new Map(items.map((item) => [keyOf(item), item]));
    return order.flatMap((key) => byKey.get(key) ?? []);
  });

  function endDrag() {
    draggedKey = null;
    overKey = null;
  }

  // <-- Lâcher une image sur une autre lui prend sa place, les autres se décalent -->
  async function drop(targetKey: number) {
    const movedKey = draggedKey;
    endDrag();
    if (movedKey === null || movedKey === targetKey) return;
    const keys = shown.map(keyOf);
    const targetIndex = keys.indexOf(targetKey);
    keys.splice(keys.indexOf(movedKey), 1);
    keys.splice(targetIndex, 0, movedKey);
    const previous = order;
    order = keys;
    if (!(await onreorder?.(keys) ?? true)) order = previous;
  }

  function startDrag(event: DragEvent, key: number) {
    draggedKey = key;
    event.dataTransfer?.setData('text/plain', String(key));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function hover(event: DragEvent, key: number) {
    if (draggedKey === null) return;
    event.preventDefault();
    overKey = key;
  }

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
    {#each shown as item (keyOf(item))}
      {@const key = keyOf(item)}
      <div
        class="cell"
        class:is-reorderable={isReordering}
        class:is-dragged={draggedKey === key}
        class:is-target={overKey === key && draggedKey !== key}
        role="listitem"
        draggable={isReordering}
        ondragstart={(event) => startDrag(event, key)}
        ondragover={(event) => hover(event, key)}
        ondrop={() => drop(key)}
        ondragend={endDrag}
      >
        {@render cell(item)}
      </div>
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

  /* <-- En mode « réorganiser », la case entière se saisit : ses liens et images ne captent plus la souris --> */
  .cell.is-reorderable {
    cursor: grab;
  }

  .cell.is-reorderable > :global(*) {
    pointer-events: none;
  }

  .cell.is-dragged {
    opacity: 0.4;
  }

  .cell.is-target {
    outline: 3px dashed var(--colorStrawberry);
    outline-offset: 4px;
    border-radius: var(--radiusSmall);
  }

  .cell > :global(*) {
    flex: 1;
    min-width: 0;
  }
</style>
