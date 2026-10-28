<script lang="ts">
  import type { ScoreFormat } from '../api/types';
  import { formatUserScore, scoreScales } from '../lib/format';

  interface Props {
    value: number;
    format: ScoreFormat;
    onchange: (value: number) => void;
  }

  let { value, format, onchange }: Props = $props();

  const scale = $derived(scoreScales[format]);
  const symbolCount = $derived(format === 'POINT_10' ? 10 : format === 'POINT_5' ? 5 : format === 'POINT_3' ? 3 : 0);
  const faceMouths = ['M8 17 Q12 13 16 17', 'M8 16 L16 16', 'M8 15 Q12 19 16 15'];

  let hovered = $state<number | null>(null);
  let sliderValue = $state(0);

  $effect.pre(() => {
    sliderValue = value;
  });

  const shown = $derived(hovered ?? value);

  // <-- Recliquer sur la note actuelle l'efface, comme sur AniList -->
  const pick = (score: number) => onchange(score === value ? 0 : score);
</script>

{#if symbolCount}
  <div class="symbols" role="radiogroup" aria-label="Ta note">
    {#each Array.from({ length: symbolCount }, (_, index) => index + 1) as score (score)}
      {@const isLit = format === 'POINT_3' ? score === shown : score <= shown}
      <button
        type="button"
        role="radio"
        aria-checked={score === value}
        aria-label="Note {score} sur {scale.max}"
        class:is-lit={isLit}
        data-sparkle
        onpointerenter={() => (hovered = score)}
        onpointerleave={() => (hovered = null)}
        onclick={() => pick(score)}
      >
        {#if format === 'POINT_3'}
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <circle class="eye" cx="9" cy="10" r="1.3" />
            <circle class="eye" cx="15" cy="10" r="1.3" />
            <path class="mouth" d={faceMouths[score - 1]} />
          </svg>
        {:else}
          <svg viewBox="0 0 48 46" width={format === 'POINT_10' ? 22 : 28} height={format === 'POINT_10' ? 22 : 28} aria-hidden="true">
            <path d="M24 3 L29.6 17.3 L45 18 L33 27.6 L37.2 42.6 L24 34 L10.8 42.6 L15 27.6 L3 18 L18.4 17.3Z" />
          </svg>
        {/if}
      </button>
    {/each}
    {#if format === 'POINT_10'}<span class="readout">{shown || '–'}</span>{/if}
  </div>
{:else}
  <div class="slider" style:--fill="{(sliderValue / scale.max) * 100}%">
    <input
      type="range"
      min="0"
      max={scale.max}
      step={scale.step}
      aria-label="Ta note"
      bind:value={sliderValue}
      onchange={() => onchange(Number(sliderValue))}
    />
    <span class="readout">{sliderValue ? formatUserScore(sliderValue, format) : '–'}</span>
  </div>
{/if}

<style>
  .symbols,
  .slider {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .symbols button {
    display: flex;
    padding: 2px;
    border: 0;
    background: none;
    cursor: pointer;
    transition: transform 0.2s var(--easeSpring);
  }

  .symbols svg {
    fill: var(--colorPaper);
    stroke: var(--colorInk);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .symbols .is-lit svg {
    fill: var(--colorStar);
  }

  .symbols button:hover {
    transform: scale(1.25) rotate(-8deg);
  }

  .eye {
    fill: var(--colorInk);
    stroke: none;
  }

  .mouth {
    fill: none;
    stroke-linecap: round;
  }

  .readout {
    min-width: 34px;
    margin-left: var(--space2);
    font-family: var(--fontTitle);
    font-size: var(--fontSizeMd);
    text-align: right;
  }

  .slider {
    gap: var(--space3);
  }

  input[type='range'] {
    width: 180px;
    height: 12px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: linear-gradient(90deg, var(--colorStar) var(--fill), var(--colorPaper) var(--fill));
    cursor: pointer;
    appearance: none;
  }

  input[type='range']::-webkit-slider-thumb {
    width: 22px;
    height: 22px;
    border: var(--outline);
    border-radius: 50%;
    background: var(--colorStrawberry);
    box-shadow: 2px 2px 0 var(--colorInk);
    appearance: none;
  }
</style>
