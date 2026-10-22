<script lang="ts">
  import type { MediaDetails } from '../../api/queries/media';
  import Icon from '../../components/Icon.svelte';
  import Section from '../../components/Section.svelte';
  import { invoke } from '../../lib/bridge';
  import { nyaaEpisodeSearchUrl } from '../../lib/nyaa';
  import { library } from '../../state/library.svelte';
  import { mediaList } from '../../state/mediaList.svelte';
  import { playback } from '../../state/playback.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    media: MediaDetails;
  }

  let { media }: Props = $props();

  // <-- Les très longues séries n'affichent qu'une fenêtre autour de l'épisode en cours -->
  const windowBefore = 12;
  const windowSize = 60;

  const files = $derived(library.episodesFor(media.id));
  const folders = $derived(library.foldersFor(media.id));
  const progress = $derived(mediaList.entryFor(media.id)?.progress ?? 0);
  const airedCount = $derived(media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : (media.episodes ?? 0));
  const episodeCount = $derived(Math.max(media.episodes ?? 0, airedCount, ...files.keys()));
  let showsAll = $state(false);

  const visibleEpisodes = $derived.by(() => {
    const isWindowed = !showsAll && episodeCount > windowSize;
    const first = isWindowed ? Math.max(1, Math.min(progress - windowBefore, episodeCount - windowSize + 1)) : 1;
    const last = isWindowed ? first + windowSize - 1 : episodeCount;
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
  });

  const nyaaTitle = $derived(media.title.romaji ?? media.title.userPreferred);

  async function openFolder(path: string) {
    try {
      await invoke('shell.openPath', { path });
    } catch (error) {
      toasts.error(error);
    }
  }
</script>

{#if episodeCount > 0}
  <Section title="Les épisodes">
    {#snippet action()}
      <div class="folder-actions">
        {#each folders as folder (folder.path)}
          <button class="btn btn-ghost btn-sm" type="button" title={folder.path} onclick={() => openFolder(folder.path)}>
            <Icon name="folder" size={14} /> {folder.name}
          </button>
        {:else}
          <a class="btn btn-ghost btn-sm" href={library.hasRoot ? '#/library' : '#/settings'}>
            <Icon name="link" size={14} />
            {library.hasRoot ? 'Lier un dossier' : 'Choisir mon dossier d’anime'}
          </a>
        {/each}
      </div>
    {/snippet}

    <div class="episodes">
      {#each visibleEpisodes as episode (episode)}
        {@const file = files.get(episode)}
        {@const isWatched = episode <= progress}
        {@const hasAired = episode <= airedCount || Boolean(file)}
        {#if file}
          <button
            class="episode is-downloaded"
            class:is-watched={isWatched}
            class:is-next={episode === progress + 1}
            type="button"
            title="Regarder l'épisode {episode} : {file.fileName}"
            onclick={() => playback.requestPlay(media, episode)}
          >
            <span class="number">{episode}</span>
            {#if isWatched}<span class="stamp" aria-label="vu">vu !</span>{:else}<Icon name="play" size={12} filled />{/if}
          </button>
        {:else if hasAired}
          <a
            class="episode"
            class:is-watched={isWatched}
            href={nyaaEpisodeSearchUrl(nyaaTitle, episode)}
            target="_blank"
            rel="noopener noreferrer"
            title="L'épisode {episode} n'est pas téléchargé : le chercher sur Nyaa"
          >
            <span class="number">{episode}</span>
            <Icon name="search" size={12} />
          </a>
        {:else}
          <span class="episode is-upcoming" title="Pas encore diffusé"><span class="number">{episode}</span></span>
        {/if}
      {/each}
    </div>

    {#if episodeCount > windowSize}
      <button class="btn btn-ghost btn-sm more" type="button" onclick={() => (showsAll = !showsAll)}>
        {showsAll ? 'Voir moins' : `Voir les ${episodeCount} épisodes`}
      </button>
    {/if}
  </Section>
{/if}

<style>
  .folder-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space1);
  }

  /* <-- Chaque épisode est un petit autocollant : téléchargé, vu (tamponné), à chercher ou pas encore sorti --> */
  .episodes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: var(--space3);
  }

  .episode {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
    color: var(--textSoft);
    cursor: pointer;
    transition: transform 0.2s var(--easeSpring), box-shadow var(--transitionFast);
  }

  .episode:hover {
    box-shadow: 2px 2px 0 var(--colorInk);
    transform: rotate(-3deg) scale(1.06);
  }

  .number {
    font-family: var(--fontTitle);
  }

  .is-downloaded {
    border-width: 2px;
    color: var(--textMain);
  }

  .is-watched {
    background: var(--colorMauve);
  }

  .stamp {
    color: var(--colorDanger);
    font-family: var(--fontHand);
    font-size: 1.6rem;
    line-height: 1;
    transform: rotate(-12deg);
  }

  .is-next {
    background: var(--colorStar);
    box-shadow: 2px 2px 0 var(--colorInk);
  }

  .is-upcoming {
    border-style: dashed;
    color: var(--textFaint);
    cursor: default;
  }

  .is-upcoming:hover {
    box-shadow: none;
    transform: none;
  }

  .more {
    margin-top: var(--space4);
  }
</style>
