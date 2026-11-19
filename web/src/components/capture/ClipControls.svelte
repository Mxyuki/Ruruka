<script lang="ts">
  import type { ClipFormat, ClipQuality } from '../../lib/bridge';
  import { formatClock } from '../../lib/format';

  interface Props {
    startSeconds: number;
    endSeconds: number;
    quality: ClipQuality;
    format: ClipFormat;
    /** Where the video was paused: the clip usually ends there. */
    positionSeconds: number;
    durationSeconds: number;
  }

  let { startSeconds = $bindable(), endSeconds = $bindable(), quality = $bindable(), format = $bindable(), positionSeconds, durationSeconds }: Props = $props();

  const minimumLengthSeconds = 0.5;
  const lastSecondsChoices = [5, 10, 20, 30];
  const fineStepSeconds = 1;

  const lengthSeconds = $derived(endSeconds - startSeconds);

  const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

  function formatPrecise(seconds: number): string {
    return `${formatClock(seconds)}.${Math.floor((seconds % 1) * 10)}`;
  }

  function takeLast(seconds: number) {
    endSeconds = positionSeconds;
    startSeconds = Math.max(0, positionSeconds - seconds);
  }

  function moveStart(seconds: number) {
    startSeconds = clamp(seconds, 0, endSeconds - minimumLengthSeconds);
  }

  function moveEnd(seconds: number) {
    endSeconds = clamp(seconds, startSeconds + minimumLengthSeconds, durationSeconds);
  }
</script>

<!-- Les bornes du clip : par défaut les secondes qui précèdent l'image figée -->
<div class="clip">
  <div class="row">
    <span class="note-label">Les dernières secondes</span>
    {#each lastSecondsChoices as seconds (seconds)}
      <button class="chip" class:is-active={Math.abs(lengthSeconds - seconds) < 0.05 && endSeconds === positionSeconds} type="button" onclick={() => takeLast(seconds)}>
        {seconds} s
      </button>
    {/each}
  </div>

  {#each [{ label: 'Début', value: startSeconds, move: moveStart }, { label: 'Fin', value: endSeconds, move: moveEnd }] as bound (bound.label)}
    <div class="bound">
      <span class="label">{bound.label}</span>
      <button class="btn btn-ghost btn-sm" type="button" aria-label="{bound.label} une seconde plus tôt" onclick={() => bound.move(bound.value - fineStepSeconds)}>−1 s</button>
      <input
        type="range"
        min="0"
        max={durationSeconds}
        step="0.1"
        value={bound.value}
        aria-label={bound.label}
        oninput={(event) => bound.move(event.currentTarget.valueAsNumber)}
      />
      <button class="btn btn-ghost btn-sm" type="button" aria-label="{bound.label} une seconde plus tard" onclick={() => bound.move(bound.value + fineStepSeconds)}>+1 s</button>
      <span class="time">{formatPrecise(bound.value)}</span>
    </div>
  {/each}

  <div class="row">
    <span class="note-label">Qualité</span>
    <button class="chip" class:is-active={quality === 'max'} type="button" onclick={() => (quality = 'max')}>Qualité max</button>
    <button class="chip" class:is-active={quality === 'discord'} type="button" onclick={() => (quality = 'discord')} title="Sous les 10 Mo, pour l'envoyer directement sur Discord">
      Léger pour Discord
    </button>
  </div>

  <div class="row">
    <span class="note-label">Fichier</span>
    <button class="chip" class:is-active={format === 'mp4'} type="button" onclick={() => (format = 'mp4')} title="Le plus répandu : s’ouvre partout (téléphone, Discord, réseaux)">MP4</button>
    <button class="chip" class:is-active={format === 'webm'} type="button" onclick={() => (format = 'webm')} title="Plus léger à qualité égale ; lu par les navigateurs et Discord, moins par les vieux lecteurs">WebM</button>
    <span class="length">Durée : {lengthSeconds.toFixed(1)} s</span>
  </div>
</div>

<style>
  .clip {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
  }

  .row,
  .bound {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .chip {
    border: 0;
    cursor: pointer;
  }

  .label {
    width: 48px;
    font-weight: 800;
  }

  .bound input {
    flex: 1;
    min-width: 120px;
    accent-color: var(--colorStar);
  }

  .time,
  .length {
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .time {
    min-width: 70px;
    text-align: right;
  }

  .length {
    margin-left: auto;
    color: var(--textSoft);
  }
</style>
