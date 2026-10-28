<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    /** A short handwritten line under the title. */
    note?: string;
    actions?: Snippet;
  }

  let { title, note, actions }: Props = $props();
</script>

<header>
  <div class="text">
    <h1>{title}</h1>
    {#if note}<p>{note}</p>{/if}
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space4);
    margin-bottom: var(--space6);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* <-- Titre surligné au feutre jaune, comme dans un carnet --> */
  h1 {
    position: relative;
    z-index: 0;
    align-self: flex-start;
    font-size: var(--fontSize2xl);
  }

  h1::after {
    content: '';
    position: absolute;
    right: -8px;
    bottom: 6px;
    left: -6px;
    z-index: -1;
    height: 0.42em;
    border-radius: 4px;
    background: var(--colorStar);
    transform: rotate(-1deg);
  }

  p {
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 2rem;
    font-weight: 400;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }
</style>
