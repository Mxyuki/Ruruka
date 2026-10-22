<script lang="ts">
  import type { ListEntry } from '../../api/types';
  import Icon from '../../components/Icon.svelte';
  import { formatCountdown } from '../../lib/format';
  import { nyaaEpisodeSearchUrl } from '../../lib/nyaa';
  import { mediaPath } from '../../lib/routes';
  import { mediaList } from '../../state/mediaList.svelte';
  import { playback } from '../../state/playback.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    entry: ListEntry;
    isReady: boolean;
  }

  let { entry, isReady }: Props = $props();

  const media = $derived(entry.media);
  const nextEpisode = $derived(entry.progress + 1);
  const total = $derived(media.episodes);
  const airing = $derived(media.nextAiringEpisode);
  const isCaughtUp = $derived(total !== null && entry.progress >= total);
  const isWaitingForAiring = $derived(Boolean(airing && nextEpisode >= airing.episode));

  let isSaving = $state(false);

  async function increment() {
    isSaving = true;
    try {
      await mediaList.save(media, { progress: nextEpisode });
    } catch (error) {
      toasts.error(error, "Impossible de mettre à jour la progression");
    } finally {
      isSaving = false;
    }
  }
</script>

<li class="row">
  <!-- Étoile cochée quand l'épisode suivant est déjà téléchargé -->
  <svg class="star" class:is-ready={isReady} viewBox="0 0 48 46" width="22" height="22" aria-label={isReady ? 'Épisode téléchargé' : undefined} role={isReady ? 'img' : undefined} aria-hidden={!isReady}>
    <path d="M24 3 L29.6 17.3 L45 18 L33 27.6 L37.2 42.6 L24 34 L10.8 42.6 L15 27.6 L3 18 L18.4 17.3Z" />
  </svg>
  <a href="#{mediaPath(media.id)}"><img src={media.coverImage.medium} alt="" loading="lazy" /></a>
  <a class="title" href="#{mediaPath(media.id)}">{media.title.userPreferred}</a>
  <span class="episode">ÉP. {String(entry.progress).padStart(2, '0')}{total ? `/${total}` : ''}</span>

  <div class="action">
    {#if isCaughtUp}
      <span class="note">à jour !</span>
    {:else if isReady}
      <button class="btn btn-primary btn-sm" type="button" onclick={() => playback.requestPlay(media, nextEpisode)}>
        <Icon name="play" size={12} filled /> Ép. {nextEpisode}
      </button>
    {:else if isWaitingForAiring && airing}
      <span class="note">ép. {airing.episode} dans {formatCountdown(airing.timeUntilAiring)}</span>
    {:else}
      <a class="btn btn-secondary btn-sm" href={nyaaEpisodeSearchUrl(media.title.romaji ?? media.title.userPreferred, nextEpisode)} target="_blank" rel="noopener noreferrer" title="Chercher l'épisode {nextEpisode} sur Nyaa">
        Chercher
      </a>
    {/if}
  </div>

  <button class="btn btn-ghost btn-sm btn-icon" type="button" title="Marquer l'épisode {nextEpisode} comme vu" disabled={isSaving || isCaughtUp} onclick={increment}>
    <Icon name="plus" size={14} />
  </button>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: 22px 38px minmax(0, 1fr) 82px 128px 34px;
    align-items: center;
    gap: var(--space3);
    padding: 7px var(--space3);
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorPaper);
    content-visibility: auto;
    contain-intrinsic-size: auto 70px;
    transition: transform 0.2s var(--easeSpring), box-shadow var(--transitionFast);
  }

  .row:nth-child(3n + 2) {
    transform: rotate(-0.4deg);
  }

  .row:hover {
    box-shadow: var(--stickerShadow);
    transform: translate(-1px, -1px);
  }

  .star {
    fill: var(--colorPaper);
    stroke: var(--colorInk);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }

  .star.is-ready {
    fill: var(--colorStar);
  }

  img {
    width: 38px;
    height: 54px;
    border: var(--outlineThin);
    border-radius: 6px;
    object-fit: cover;
  }

  .title {
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title:hover {
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }

  .episode {
    color: var(--textSoft);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
  }

  .action {
    display: flex;
    justify-content: flex-end;
  }

  .note {
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 1.7rem;
    white-space: nowrap;
  }
</style>
