<script lang="ts">
  import Icon, { type IconName } from '../../components/Icon.svelte';

  interface Props {
    tone: 'anime' | 'planned' | 'event';
    /** Dashed outline: Ruruka worked this date out, AniList didn't announce it. */
    isEstimated?: boolean;
    icon?: IconName;
    /** Episode number or short mark before the label. */
    mark?: string;
    label: string;
    /** Sits on a cover: every fill stays opaque so the text remains readable. */
    isOnCover?: boolean;
  }

  let { tone, isEstimated = false, icon, mark, label, isOnCover = false }: Props = $props();
</script>

<span class="chip-day is-{tone}" class:is-estimated={isEstimated} class:is-on-cover={isOnCover}>
  {#if icon}<Icon name={icon} size={11} />{/if}
  {#if mark}<span class="mark">{mark}</span>{/if}
  <span class="label">{label}</span>
</span>

<style>
  /* <-- Étiquette d'un jour : la couleur double toujours une icône ou un trait, jamais seule --> */
  .chip-day {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 0;
    padding: 1px var(--space1);
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    font-size: var(--fontSizeXs);
    font-weight: 700;
    line-height: 1.35;
  }

  .is-anime {
    background: var(--colorSkySoft);
  }

  .is-planned {
    background: var(--colorMauve);
  }

  .is-event {
    background: var(--colorBlond);
  }

  .is-estimated {
    border-style: dashed;
  }

  .is-estimated.is-anime {
    background: var(--colorPaper);
  }

  .is-on-cover.is-anime {
    background: var(--colorPaper);
  }

  .mark {
    flex-shrink: 0;
    font-family: var(--fontFile);
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
