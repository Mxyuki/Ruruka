<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    action?: Snippet;
    children: Snippet;
  }

  let { title, action, children }: Props = $props();
</script>

<section>
  <header>
    <h2>{title}</h2>
    {#if action}<div class="action">{@render action()}</div>{/if}
  </header>
  {@render children()}
</section>

<style>
  section {
    counter-increment: section;
    margin-bottom: var(--space7);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space3);
    margin-bottom: var(--space4);
  }

  /* <-- Chiffre romain dans une pastille étoile, puis le titre --> */
  h2 {
    display: flex;
    align-items: center;
    gap: var(--space3);
    font-size: var(--fontSizeXl);
  }

  h2::before {
    content: counter(section, upper-roman);
    display: grid;
    min-width: 38px;
    height: 32px;
    padding: 0 8px;
    place-items: center;
    border: var(--outline);
    border-radius: var(--radiusPill);
    background: var(--colorStar);
    box-shadow: 2px 2px 0 var(--colorInk);
    font-size: 1.3rem;
  }

  header::after {
    content: '';
    flex: 1;
    order: 1;
    border-top: 2px dashed var(--colorLineStrong);
  }

  .action {
    order: 2;
  }
</style>
