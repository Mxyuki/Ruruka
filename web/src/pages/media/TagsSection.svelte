<script lang="ts">
  import type { MediaTag } from '../../api/queries/media';
  import type { MediaType } from '../../api/types';
  import Section from '../../components/Section.svelte';

  interface Props {
    tags: MediaTag[];
    type: MediaType;
  }

  let { tags, type }: Props = $props();

  const categoryOrder = ['Theme', 'Cast', 'Setting', 'Demographic', 'Technical', 'Sexual Content'];
  const tagAccents = ['var(--colorStar)', 'var(--colorStrawberry)', 'var(--colorSky)', 'var(--colorLilac)', 'var(--colorSuccess)'];

  let showsSpoilers = $state(false);
  const isSpoiler = (tag: MediaTag) => tag.isMediaSpoiler || tag.isGeneralSpoiler;
  const spoilerCount = $derived(tags.filter(isSpoiler).length);
  const orderOf = (category: string) => {
    const index = categoryOrder.indexOf(category);
    return index === -1 ? categoryOrder.length : index;
  };

  const groups = $derived.by(() => {
    const byCategory = new Map<string, MediaTag[]>();
    for (const tag of [...tags].sort((a, b) => b.rank - a.rank)) {
      if (isSpoiler(tag) && !showsSpoilers) continue;
      const category = tag.category?.split('-')[0] ?? 'Other';
      byCategory.set(category, [...(byCategory.get(category) ?? []), tag]);
    }
    return [...byCategory].sort(([a], [b]) => orderOf(a) - orderOf(b));
  });
</script>

<Section title="Les mots-clés">
  {#snippet action()}
    {#if spoilerCount}
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => (showsSpoilers = !showsSpoilers)}>
        {showsSpoilers ? 'Cacher' : 'Montrer'} {spoilerCount} spoiler{spoilerCount === 1 ? '' : 's'}
      </button>
    {/if}
  {/snippet}

  <div class="card columns">
    {#each groups as [category, categoryTags], index (category)}
      <div class="column" style:--accent={tagAccents[index % tagAccents.length]}>
        <h4 class="note-label">{category}</h4>
        {#each categoryTags as tag (tag.name)}
          <a class="tag" class:is-spoiler={isSpoiler(tag)} href="#/search/{type.toLowerCase()}?tag={encodeURIComponent(tag.name)}">
            <span class="name">{tag.name}</span>
            <span class="rank">{tag.rank}%</span>
            <span class="meter" style:--rank="{tag.rank}%"></span>
          </a>
        {/each}
      </div>
    {/each}
  </div>
</Section>

<style>
  .columns {
    padding: var(--space5) var(--space5) var(--space3);
    columns: 4 190px;
    column-gap: var(--space6);
  }

  .column {
    break-inside: avoid;
    margin-bottom: var(--space4);
  }

  .column .note-label {
    margin-bottom: var(--space2);
  }

  .tag {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 10px;
    padding: 4px 0 8px;
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
  }

  .tag:hover {
    color: var(--textSoft);
  }

  .tag.is-spoiler {
    color: var(--colorDanger);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rank {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
  }

  .meter {
    grid-column: 1 / -1;
    height: 5px;
    border-radius: var(--radiusPill);
    background:
      linear-gradient(var(--accent), var(--accent)) no-repeat left / var(--rank) 100%,
      var(--colorSunken);
  }
</style>
