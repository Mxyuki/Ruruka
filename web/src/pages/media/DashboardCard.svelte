<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    accent: string;
    span?: number;
    children: Snippet;
  }

  let { title, accent, span = 1, children }: Props = $props();
</script>

<div class="notebook-page dashboard-card" style:--accent={accent} style:--span={span}>
  <h3 class="note-label">{title}</h3>
  <div class="body">{@render children()}</div>
</div>

<style>
  .dashboard-card {
    display: flex;
    flex-direction: column;
    grid-column: span var(--span);
    min-height: 0;
    padding: var(--space3) var(--space4) var(--space3) 44px;
    font-size: var(--fontSizeSm);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
