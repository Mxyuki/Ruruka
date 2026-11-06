<script module lang="ts">
  // <-- Une seule vidéo parle à la fois : un profil peut en aligner dix qui tournent en boucle -->
  let audibleVideo: HTMLVideoElement | null = null;

  function giveSoundTo(video: HTMLVideoElement): void {
    if (audibleVideo && audibleVideo !== video) audibleVideo.muted = true;
    audibleVideo = video;
    video.muted = false;
  }

  function releaseSound(video: HTMLVideoElement): void {
    if (audibleVideo === video) audibleVideo = null;
  }
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Icon from '../../components/Icon.svelte';
  import { session } from '../../state/session.svelte';

  interface Props {
    src: string;
  }

  let { src }: Props = $props();

  const compactWidth = 200;
  const startVolume = (session.settings?.profileVideoVolumePercent ?? 30) / 100;

  let video = $state<HTMLVideoElement>();
  let isPaused = $state(true);
  let isMuted = $state(true);
  let volume = $state(startVolume);
  let width = $state(0);
  let hasFailed = $state(false);

  // <-- Ce que la personne veut : hors de l'écran la vidéo s'arrête, puis reprend seulement si elle tournait -->
  let wantsPlayback = session.settings?.isProfileVideoAutoplayed ?? true;
  let isVisible = false;
  let hasAskedForSound = session.settings?.isProfileVideoSoundOn ?? false;
  let visibilityObserver: IntersectionObserver | null = null;

  onMount(() => {
    if (!video) return;
    video.volume = startVolume;
    // <-- Une vidéo dans un spoiler fermé n'est pas à l'écran : elle ne se lance pas, et donc ne parle pas -->
    visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
      void applyPlayback();
    });
    visibilityObserver.observe(video);
  });

  onDestroy(() => {
    visibilityObserver?.disconnect();
    if (video) releaseSound(video);
  });

  async function applyPlayback(): Promise<void> {
    if (!video) return;
    if (!isVisible || !wantsPlayback) {
      video.pause();
      return;
    }
    if (hasAskedForSound && !audibleVideo) giveSoundTo(video);
    hasAskedForSound = false;
    await play(video);
  }

  // <-- WebView2 refuse le son tant qu'on n'a pas interagi avec la page : la vidéo repart alors sans le son -->
  async function play(target: HTMLVideoElement): Promise<void> {
    try {
      await target.play();
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'NotAllowedError' || target.muted) return;
      target.muted = true;
      releaseSound(target);
      await target.play().catch(() => (hasFailed = true));
    }
  }

  function syncPlayback(): void {
    isPaused = video?.paused ?? true;
  }

  function syncSound(): void {
    if (!video) return;
    isMuted = video.muted;
    volume = video.volume;
    if (video.muted) releaseSound(video);
  }

  function togglePlayback(event: Event): void {
    event.preventDefault();
    wantsPlayback = isPaused;
    void applyPlayback();
  }

  function toggleSound(): void {
    if (!video) return;
    if (!video.muted) {
      video.muted = true;
      return;
    }
    if (video.volume === 0) video.volume = startVolume || 1;
    giveSoundTo(video);
  }

  function setVolume(event: Event & { currentTarget: HTMLInputElement }): void {
    if (!video) return;
    video.volume = Number(event.currentTarget.value);
    if (video.volume === 0) video.muted = true;
    else giveSoundTo(video);
  }
</script>

<span class="player" class:is-compact={width < compactWidth} class:is-paused={isPaused} bind:clientWidth={width}>
  <!-- La vidéo garde son bouton lecture dans la barre : un clic dessus n'est qu'un raccourci -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <video
    bind:this={video}
    {src}
    loop
    muted
    playsinline
    preload="metadata"
    onclick={togglePlayback}
    onplay={syncPlayback}
    onpause={syncPlayback}
    onvolumechange={syncSound}
    onerror={() => (hasFailed = true)}
  ><track kind="captions" /></video>

  {#if !hasFailed}
    <span class="controls">
      <button type="button" aria-label={isPaused ? 'Lancer la vidéo' : 'Mettre en pause'} onclick={togglePlayback}>
        <Icon name={isPaused ? 'play' : 'pause'} size={14} filled={isPaused} />
      </button>
      <button type="button" aria-label={isMuted ? 'Activer le son' : 'Couper le son'} onclick={toggleSound}>
        <Icon name={isMuted ? 'volumeOff' : 'volume'} size={14} />
      </button>
      {#if width >= compactWidth}
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label="Volume"
          style:--fill="{(isMuted ? 0 : volume) * 100}%"
          value={isMuted ? 0 : volume}
          oninput={setVolume}
        />
      {/if}
    </span>
  {/if}
</span>

<style>
  .player {
    position: relative;
    display: inline-block;
    max-width: 100%;
    vertical-align: middle;
  }

  video {
    display: block;
    cursor: pointer;
  }

  /* <-- Barre posée sur la vidéo, comme un autocollant, seulement quand on en a besoin --> */
  .controls {
    position: absolute;
    bottom: var(--space2);
    left: var(--space2);
    display: inline-flex;
    align-items: center;
    gap: var(--space1);
    padding: 2px var(--space2);
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    box-shadow: 2px 2px 0 var(--colorInk);
    color: var(--textMain);
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .is-compact .controls {
    bottom: 2px;
    left: 2px;
    padding: 0 2px;
    box-shadow: none;
  }

  .player:hover .controls,
  .player:focus-within .controls,
  .is-paused .controls {
    opacity: 1;
  }

  button {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  button:hover {
    background: var(--colorSunken);
  }

  input[type='range'] {
    width: 72px;
    height: 10px;
    margin: 0 var(--space1);
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: linear-gradient(90deg, var(--colorStar) var(--fill), var(--colorPaper) var(--fill));
    cursor: pointer;
    appearance: none;
  }

  input[type='range']::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    border: var(--outlineThin);
    border-radius: 50%;
    background: var(--colorStrawberry);
    appearance: none;
  }
</style>
