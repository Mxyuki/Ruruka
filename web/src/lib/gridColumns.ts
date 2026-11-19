/** Svelte action: tells how many columns a CSS grid shows now, and again whenever its width changes. */
export function trackColumns(grid: HTMLElement, onchange: (columns: number) => void) {
  const read = () => onchange(Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length));
  const observer = new ResizeObserver(read);
  observer.observe(grid);
  read();
  return { destroy: () => observer.disconnect() };
}

/** How many items to show so that the last row is full; every item once nothing more can be loaded. */
export function fullRowCount(loaded: number, columns: number, canLoadMore: boolean): number {
  if (!canLoadMore || loaded < columns) return loaded;
  return loaded - (loaded % columns);
}
