<script lang="ts">
  import { quickSearchMedia } from '../../api/queries/media';
  import type { MediaSummary } from '../../api/types';
  import { formatEnum } from '../../lib/format';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    onpick: (media: MediaSummary) => void;
  }

  let { onpick }: Props = $props();

  const searchDelayMs = 400;
  let query = $state('');
  let results = $state<MediaSummary[]>([]);
  let isSearching = $state(false);

  $effect(() => {
    const search = query.trim();
    if (!search) {
      results = [];
      return;
    }
    const timer = setTimeout(async () => {
      isSearching = true;
      try {
        results = await quickSearchMedia(search);
      } catch (error) {
        toasts.error(error, 'La recherche a échoué');
      } finally {
        isSearching = false;
      }
    }, searchDelayMs);
    return () => clearTimeout(timer);
  });
</script>

<input class="input" type="search" placeholder="Chercher un anime, même déjà terminé…" aria-label="Chercher un anime" bind:value={query} />

{#if query.trim()}
  <ul class:is-searching={isSearching}>
    {#each results as media (media.id)}
      <li>
        <button type="button" onclick={() => onpick(media)}>
          <img src={media.coverImage.medium} alt="" loading="lazy" width="32" height="45" />
          <span class="info">
            <span class="title">{media.title.userPreferred}</span>
            <span class="faint">
              {[formatEnum(media.format), media.seasonYear, media.episodes && `${media.episodes} ép.`].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
      </li>
    {:else}
      <li class="faint empty">{isSearching ? 'Recherche…' : 'Aucun anime trouvé pour l’instant'}</li>
    {/each}
  </ul>
{/if}

<style>
  .input {
    width: 100%;
  }

  ul {
    max-height: 220px;
    margin: var(--space2) 0 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    transition: opacity var(--transitionFast);
  }

  ul.is-searching {
    opacity: 0.6;
  }

  button {
    display: flex;
    align-items: center;
    gap: var(--space2);
    width: 100%;
    padding: var(--space1);
    border: 0;
    border-radius: var(--radiusSmall);
    background: none;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }

  button:hover {
    background: var(--colorSunken);
  }

  img {
    flex-shrink: 0;
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: var(--fontSizeXs);
  }

  .title {
    font-size: var(--fontSizeSm);
    font-weight: 700;
  }

  .empty {
    padding: var(--space3);
    text-align: center;
  }
</style>
