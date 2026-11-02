<script lang="ts">
  import type { MediaSummary } from '../../api/types';
  import { formatClock } from '../../lib/format';
  import type { SharedEpisode } from '../../state/groupWatch.svelte';

  interface Props {
    media: MediaSummary;
    shared: SharedEpisode;
  }

  let { media, shared }: Props = $props();

  const percent = $derived(shared.durationSeconds ? Math.min(100, (shared.positionSeconds / shared.durationSeconds) * 100) : 0);
</script>

<div class="episode">
  <img src={media.coverImage.medium} alt="" loading="lazy" width="56" height="80" />
  <div class="details">
    <strong>{media.title.userPreferred}</strong>
    <span class="counter">
      ÉP. {String(shared.episode).padStart(2, '0')}
      {#if shared.durationSeconds}· {formatClock(shared.positionSeconds)} / {formatClock(shared.durationSeconds)}{/if}
    </span>
    <!-- Ruban de progression, coché une fois l'épisode vu -->
    <span class="track"><span class="fill" style:width="{percent}%"></span></span>
    {#if shared.isWatched}<span class="seen">vu !</span>{/if}
  </div>
</div>

<style>
  .episode {
    display: flex;
    gap: var(--space4);
    align-items: center;
  }

  img {
    flex-shrink: 0;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .details {
    display: grid;
    flex: 1;
    gap: var(--space1);
    min-width: 0;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .counter {
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .track {
    height: 8px;
    overflow: hidden;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorSunken);
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--colorStar);
  }

  .seen {
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: var(--fontSizeLg);
  }
</style>
