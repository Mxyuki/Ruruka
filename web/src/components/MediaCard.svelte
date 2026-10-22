<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { MediaSummary } from '../api/types';
  import { formatListStatus, statusColor } from '../lib/format';
  import { mediaPath } from '../lib/routes';
  import { mediaList } from '../state/mediaList.svelte';

  interface Props {
    media: MediaSummary;
    subtitle?: string;
    overlay?: Snippet;
  }

  let { media, subtitle, overlay }: Props = $props();

  const entry = $derived(mediaList.entryFor(media.id));
  // <-- Chaque carte garde toujours la même petite inclinaison, comme posée à la main -->
  const tilt = $derived(((media.id * 37) % 7) - 3);
</script>

<a class="media-card" href="#{mediaPath(media.id)}" title={media.title.userPreferred} style:--tilt="{tilt * 0.6}deg">
  <div class="cover" style:--coverColor={media.coverImage.color}>
    <img src={media.coverImage.large} alt="" loading="lazy" />
    {#if media.averageScore}
      <span class="score">{media.averageScore}<small>%</small></span>
    {/if}
    {#if entry}
      <span class="status" style:--status={statusColor(entry.status)} title="Dans ta liste : {formatListStatus(entry.status, media.type)}"></span>
    {/if}
    {#if overlay}<div class="overlay">{@render overlay()}</div>{/if}
  </div>
  <span class="title">{media.title.userPreferred}</span>
  {#if subtitle}<span class="subtitle">{subtitle}</span>{/if}
</a>

<style>
  /* <-- content-visibility rogne ce qui dépasse : la marge intérieure garde la pastille, l'inclinaison et le zoom visibles --> */
  .media-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 26px 22px 6px 8px;
    margin: -26px -22px -6px -8px;
    content-visibility: auto;
    contain-intrinsic-size: auto 350px;
  }

  /* <-- La jaquette est une carte à collectionner : cadre crème, contour d'encre, ombre d'autocollant --> */
  .cover {
    position: relative;
    aspect-ratio: 2 / 3;
    padding: 5px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorCollar);
    box-shadow: var(--stickerShadow);
    transform: rotate(var(--tilt));
    transition: transform 0.3s var(--easeSpring), box-shadow var(--transitionFast);
  }

  .cover img {
    width: 100%;
    height: 100%;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--coverColor, var(--coverFallback));
    object-fit: cover;
  }

  .media-card:hover .cover {
    box-shadow: var(--stickerShadowLarge);
    transform: rotate(0deg) translate(-2px, -4px) scale(1.03);
  }

  .score {
    position: absolute;
    top: -10px;
    right: -10px;
    display: flex;
    width: 46px;
    height: 46px;
    align-items: center;
    justify-content: center;
    border: var(--outline);
    border-radius: 50%;
    background: var(--colorStar);
    box-shadow: 2px 2px 0 var(--colorInk);
    font-family: var(--fontTitle);
    font-size: 1.2rem;
    white-space: nowrap;
    transform: rotate(8deg);
  }

  .score small {
    margin-left: -2px;
    font-size: 0.7em;
  }

  .status {
    position: absolute;
    bottom: 12px;
    left: 12px;
    width: 16px;
    height: 16px;
    border: var(--outline);
    border-radius: 50%;
    background: var(--status);
  }

  .overlay {
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 2px 10px;
    border: var(--outline);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
  }

  .title {
    display: -webkit-box;
    overflow: hidden;
    font-size: var(--fontSizeSm);
    font-weight: 800;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .media-card:hover .title {
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }

  .subtitle {
    margin-top: -6px;
    color: var(--textFaint);
    font-family: var(--fontHand);
    font-size: 1.6rem;
    font-weight: 400;
  }
</style>
