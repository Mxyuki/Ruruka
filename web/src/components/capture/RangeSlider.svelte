<script lang="ts">
  interface Props {
    start: number;
    end: number;
    max: number;
    /** The two points never come closer than this. */
    minGapSeconds?: number;
    /** Where the video was frozen, drawn as a tick on the bar. */
    markerSeconds?: number;
    /** A point was moved by the person: the time it now shows. */
    onmove?: (seconds: number) => void;
  }

  let { start = $bindable(), end = $bindable(), max, minGapSeconds = 0.5, markerSeconds, onmove }: Props = $props();

  type Thumb = 'start' | 'end';

  const stepSeconds = 0.1;
  const bigStepSeconds = 1;

  let track = $state<HTMLDivElement>();
  let dragged = $state<Thumb | null>(null);
  let isTied = false;

  const percentOf = (seconds: number) => (max > 0 ? (seconds / max) * 100 : 0);

  const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
  const snap = (seconds: number) => Math.round(seconds / stepSeconds) * stepSeconds;

  function move(thumb: Thumb, seconds: number) {
    if (thumb === 'start') start = clamp(snap(seconds), 0, end - minGapSeconds);
    else end = clamp(snap(seconds), start + minGapSeconds, max);
    onmove?.(thumb === 'start' ? start : end);
  }

  function secondsAt(clientX: number): number {
    const bounds = track!.getBoundingClientRect();
    return clamp((clientX - bounds.left) / bounds.width, 0, 1) * max;
  }

  // <-- Le point le plus proche suit le doigt ; s'ils se touchent, le sens du premier mouvement choisit -->
  function grab(event: PointerEvent) {
    if (!track) return;
    const seconds = secondsAt(event.clientX);
    isTied = end - start <= minGapSeconds + stepSeconds / 2 && Math.abs(seconds - start) < minGapSeconds;
    dragged = Math.abs(seconds - start) <= Math.abs(seconds - end) ? 'start' : 'end';
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (!isTied) move(dragged, seconds);
  }

  function drag(event: PointerEvent) {
    if (!dragged) return;
    const seconds = secondsAt(event.clientX);
    if (isTied) {
      dragged = seconds < start ? 'start' : 'end';
      isTied = false;
    }
    move(dragged, seconds);
  }

  function release() {
    dragged = null;
  }

  function nudge(thumb: Thumb, event: KeyboardEvent) {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    move(thumb, (thumb === 'start' ? start : end) + direction * (event.shiftKey ? bigStepSeconds : stepSeconds));
  }
</script>

<!-- Une barre, deux points : le début et la fin de l'extrait -->
<div class="slider" role="group" aria-label="Extrait du clip" onpointerdown={grab} onpointermove={drag} onpointerup={release} onpointercancel={release}>
  <div class="rail" bind:this={track}>
    <div class="selection" style:left="{percentOf(start)}%" style:width="{percentOf(end) - percentOf(start)}%"></div>
    {#if markerSeconds !== undefined}
      <span class="marker" style:left="{percentOf(markerSeconds)}%" title="Image figée"></span>
    {/if}
    {#each [{ thumb: 'start', label: 'Début', value: start }, { thumb: 'end', label: 'Fin', value: end }] as handle (handle.thumb)}
      <div
        class="thumb"
        class:is-dragged={dragged === handle.thumb}
        style:left="{percentOf(handle.value)}%"
        role="slider"
        tabindex="0"
        aria-label={handle.label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={handle.value}
        onkeydown={(event) => nudge(handle.thumb as Thumb, event)}
      ></div>
    {/each}
  </div>
</div>

<style>
  .slider {
    padding: var(--space3) 12px;
    cursor: pointer;
    touch-action: none;
  }

  .rail {
    position: relative;
    height: 10px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorSunken);
  }

  .selection {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--colorBlond);
  }

  .marker {
    position: absolute;
    top: -6px;
    bottom: -6px;
    width: 0;
    border-left: 2px dashed var(--textSoft);
    pointer-events: none;
  }

  .thumb {
    position: absolute;
    top: 50%;
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border: var(--outline);
    border-radius: 50%;
    background: var(--colorStar);
    box-shadow: 2px 2px 0 var(--colorInk);
    cursor: grab;
  }

  .thumb.is-dragged {
    cursor: grabbing;
    transform: scale(1.12);
  }

  .thumb:focus-visible {
    outline: 3px solid var(--colorSky);
    outline-offset: 2px;
  }
</style>
