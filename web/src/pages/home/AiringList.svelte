<script lang="ts">
  import type { ListEntry } from '../../api/types';
  import { formatCountdown } from '../../lib/format';
  import { mediaPath } from '../../lib/routes';

  interface Props {
    entries: ListEntry[];
  }

  let { entries }: Props = $props();
</script>

{#if entries.length}
  <!-- Page de carnet : une ligne par prochain épisode -->
  <ul class="notebook-page">
    {#each entries as entry (entry.id)}
      {@const airing = entry.media.nextAiringEpisode}
      {#if airing}
        <li>
          <a href="#{mediaPath(entry.media.id)}">
            <span class="title">{entry.media.title.userPreferred}</span>
            <span class="when">ép. {airing.episode} · {formatCountdown(airing.timeUntilAiring)}</span>
          </a>
        </li>
      {/if}
    {/each}
  </ul>
{:else}
  <p class="faint">Aucun épisode attendu : rien de ce que tu regardes n'est en diffusion.</p>
{/if}

<style>
  ul {
    margin: 0;
    padding: 10px var(--space4) 10px 44px;
    list-style: none;
  }

  a {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space3);
    height: 28px;
  }

  .title {
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  a:hover .title {
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }

  .when {
    flex-shrink: 0;
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 1.7rem;
  }
</style>
