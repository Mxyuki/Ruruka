<script lang="ts">
  import type { Snippet } from 'svelte';
  import { sanitizeHtml } from '../lib/html';

  interface Props {
    image: string;
    name: string;
    nativeName?: string | null;
    facts: [string, string | null | undefined][];
    description?: string | null;
    children: Snippet;
  }

  let { image, name, nativeName, facts, description, children }: Props = $props();
  const visibleFacts = $derived(facts.filter((fact): fact is [string, string] => Boolean(fact[1])));
</script>

<div class="page">
  <header>
    <img src={image} alt="" />
    <div class="info">
      <h1>{name}</h1>
      {#if nativeName}<p class="native">{nativeName}</p>{/if}
      {#if visibleFacts.length}
        <dl>
          {#each visibleFacts as [label, value] (label)}
            <dt>{label}</dt>
            <dd>{value}</dd>
          {/each}
        </dl>
      {/if}
      {#if description}
        <div class="description rich-text">{@html sanitizeHtml(description)}</div>
      {/if}
    </div>
  </header>

  {@render children()}
</div>

<style>
  header {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: var(--space6);
    margin-bottom: var(--space6);
  }

  img {
    width: 200px;
    border-radius: var(--radiusSmall);
    box-shadow: var(--stickerShadow);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
  }

  h1 {
    font-size: var(--fontSize2xl);
  }

  .native {
    margin-top: calc(var(--space3) * -1);
    color: var(--textFaint);
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 4px var(--space4);
    margin: 0;
    font-size: var(--fontSizeSm);
  }

  dt {
    color: var(--textFaint);
  }

  dd {
    margin: 0;
  }

  .description {
    max-width: 860px;
    max-height: 320px;
    overflow-y: auto;
    color: var(--textSoft);
    line-height: 1.7;
  }
</style>
