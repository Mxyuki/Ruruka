<script lang="ts">
  import type { ListEntry } from '../../api/types';
  import Icon from '../../components/Icon.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import { formatCountdown } from '../../lib/format';
  import { episodeSearchUrl } from '../../lib/searchSite';
  import { siteName } from '../../lib/siteAddress';
  import { mediaPath } from '../../lib/routes';
  import { playback } from '../../state/playback.svelte';
  import { session } from '../../state/session.svelte';

  interface Props {
    entry: ListEntry;
    isReady: boolean;
  }

  let { entry, isReady }: Props = $props();

  const media = $derived(entry.media);
  const nextEpisode = $derived(entry.progress + 1);
  const total = $derived(media.episodes);
  const airing = $derived(media.nextAiringEpisode);
  const isWaitingForAiring = $derived(Boolean(airing && nextEpisode >= airing.episode));
</script>

<section class="case">
  <!-- Bannière de l'anime, scotchée dans le carnet avec une trame manga -->
  <div class="banner" style:--banner="url('{media.bannerImage ?? media.coverImage.large}')" class:is-cover={!media.bannerImage}>
    <i class="tape is-sky"></i>
    <Sticker name="loupe" size={78} rotate={-14} position="top: -34px; right: 36px" />
    <div class="caption">
      <a class="title" href="#{mediaPath(media.id)}">{media.title.userPreferred}</a>
      <div class="actions">
        {#if isReady}
          <button class="btn btn-primary" type="button" onclick={() => playback.requestPlay(media, nextEpisode)}>
            <Icon name="play" size={14} filled /> Épisode {nextEpisode}
          </button>
        {:else if isWaitingForAiring && airing}
          <span class="sticker">Ép. {airing.episode} dans {formatCountdown(airing.timeUntilAiring)}</span>
        {:else if session.searchSite}
          <a
            class="btn btn-secondary"
            href={episodeSearchUrl(session.searchSite, media.title.romaji ?? media.title.userPreferred, nextEpisode)}
            target="_blank"
            rel="noopener noreferrer"
            title="Chercher l'épisode {nextEpisode} sur {siteName(session.searchSite)}"
          >
            <Icon name="search" size={14} /> Chercher l'ép. {nextEpisode}
          </a>
        {/if}
        <span class="progress">{entry.progress}{total ? ` / ${total}` : ''} vus</span>
      </div>
    </div>
  </div>

  <!-- Carte du jour : la jaquette, qui se retourne pour révéler l'épisode suivant -->
  <a class="flip" href="#{mediaPath(media.id)}" aria-label="Ouvrir la fiche de {media.title.userPreferred}">
    <span class="inner">
      <span class="face front">
        <span class="badge">{nextEpisode}</span>
        <img src={media.coverImage.large} alt="" />
      </span>
      <span class="face back">
        <span class="label">
          <strong>Épisode {nextEpisode}</strong>
          <span>{isReady ? 'prêt à regarder !' : isWaitingForAiring ? 'bientôt…' : 'à trouver'}</span>
        </span>
      </span>
    </span>
  </a>
</section>

<style>
  .case {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 190px;
    align-items: center;
    gap: var(--space6);
    margin-bottom: var(--space7);
  }

  .banner {
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 260px;
    padding: var(--space5);
    border: var(--outline);
    border-radius: var(--radiusLarge);
    background: var(--screentone), var(--banner) center / cover;
    box-shadow: var(--stickerShadowLarge);
    transform: rotate(-0.6deg);
  }

  .banner.is-cover {
    background: var(--screentone), var(--banner) center 30% / cover;
  }

  .banner .tape {
    top: -10px;
    left: 40px;
  }

  .caption {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space3);
  }

  .title {
    max-width: 640px;
    padding: 4px 16px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    font-family: var(--fontTitle);
    font-size: clamp(2.2rem, 2vw, 3rem);
    line-height: 1.2;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space3);
  }

  .sticker,
  .progress {
    padding: 4px 12px;
    border: var(--outline);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    font-weight: 800;
  }

  .progress {
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
  }

  /* <-- Carte qui se retourne au survol ou au focus clavier --> */
  .flip {
    display: block;
    width: 190px;
    height: 285px;
    perspective: 900px;
  }

  .inner {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    transform: rotate(4deg);
    transform-style: preserve-3d;
    transition: transform 0.6s var(--easeSpring);
  }

  .flip:hover .inner,
  .flip:focus-visible .inner {
    transform: rotate(0deg) rotateY(180deg);
  }

  .face {
    position: absolute;
    inset: 0;
    padding: 6px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    box-shadow: var(--stickerShadow);
    backface-visibility: hidden;
  }

  .front {
    background: var(--colorCollar);
  }

  .front img {
    width: 100%;
    height: 100%;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .badge {
    position: absolute;
    top: -14px;
    left: calc(50% - 22px);
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: var(--outline);
    border-radius: 50%;
    background: var(--colorStar);
    font-family: var(--fontTitle);
    font-size: 1.5rem;
  }

  .back {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space2);
    padding: 0;
    overflow: hidden;
    background: url('/art/dos-de-carte.png') center / cover, var(--colorLilac);
    text-align: center;
    transform: rotateY(180deg);
  }

  .back .label {
    display: flex;
    flex-direction: column;
    padding: 6px 14px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
  }

  .back strong {
    font-family: var(--fontTitle);
    font-size: 2rem;
    font-weight: 400;
  }

  .back span {
    font-family: var(--fontHand);
    font-size: 1.9rem;
  }
</style>
