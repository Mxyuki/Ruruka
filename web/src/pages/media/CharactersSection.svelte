<script lang="ts">
  import type { CharacterEdge } from '../../api/queries/media';
  import Section from '../../components/Section.svelte';
  import { formatEnum } from '../../lib/format';
  import { characterPath, staffPath } from '../../lib/routes';

  interface Props {
    characters: CharacterEdge[];
  }

  let { characters }: Props = $props();

  const targetCount = 12;
  const minCardWidth = 260;
  let showsAll = $state(false);
  let grid = $state<HTMLElement>();
  let gridWidth = $state(0);

  const maxColumns = $derived.by(() => {
    if (!gridWidth || !grid) return 4;
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    return Math.max(1, Math.floor((gridWidth + gap) / (minCardWidth + gap)));
  });
  // <-- Replié, on montre des rangées pleines (12 sur 4 colonnes, 15 sur 5…) ; sinon des rangées égales plutôt qu'une orpheline -->
  const collapsedCount = $derived(maxColumns * Math.ceil(targetCount / maxColumns));
  const visible = $derived(showsAll ? characters : characters.slice(0, collapsedCount));
  const columns = $derived(Math.ceil(visible.length / Math.ceil(visible.length / maxColumns)) || 1);
</script>

<Section title="Les suspects">
  {#snippet action()}
    {#if characters.length > collapsedCount}
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => (showsAll = !showsAll)}>
        {showsAll ? 'Voir moins' : `Voir les ${characters.length}`}
      </button>
    {/if}
  {/snippet}

  <div class="grid" style:--columns={columns} bind:this={grid} bind:clientWidth={gridWidth}>
    {#each visible as edge (edge.node.id)}
      {@const [voiceActor] = edge.voiceActors}
      <div class="card character" class:has-voice={voiceActor}>
        <a href="#{characterPath(edge.node.id)}" aria-label={edge.node.name.userPreferred}>
          <img src={edge.node.image.medium} alt="" loading="lazy" />
        </a>
        <div class="body">
          <a class="name" href="#{characterPath(edge.node.id)}">{edge.node.name.userPreferred}</a>
          <span class="role">{formatEnum(edge.role)}</span>
          {#if voiceActor}
            <a class="voice" href="#{staffPath(voiceActor.id)}">{voiceActor.name.userPreferred}</a>
          {/if}
        </div>
        {#if voiceActor}
          <a href="#{staffPath(voiceActor.id)}" aria-label={voiceActor.name.userPreferred}>
            <img src={voiceActor.image.medium} alt="" loading="lazy" />
          </a>
        {/if}
      </div>
    {/each}
  </div>
</Section>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    gap: var(--space3) var(--space4);
  }

  .character {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    height: 82px;
    overflow: hidden;
  }

  .character.has-voice {
    grid-template-columns: 58px minmax(0, 1fr) 58px;
  }

  img {
    width: 58px;
    height: 82px;
    object-fit: cover;
  }

  .body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 8px 10px;
    font-size: var(--fontSizeSm);
  }

  .body > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
  }

  .voice {
    margin-top: auto;
    color: var(--textSoft);
    text-align: right;
  }

  .body a:hover {
    color: var(--textSoft);
  }
</style>
