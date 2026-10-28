<script lang="ts">
  import type { MediaDetails } from '../../api/queries/media';
  import Section from '../../components/Section.svelte';

  interface Props {
    trailer: NonNullable<MediaDetails['trailer']>;
  }

  let { trailer }: Props = $props();

  const embedUrls: Record<string, (id: string) => string> = {
    youtube: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
    dailymotion: (id) => `https://www.dailymotion.com/embed/video/${id}?autoplay=1`,
  };

  const embedUrl = $derived(embedUrls[trailer.site]?.(trailer.id));
  // <-- Le lecteur n'est créé qu'au clic : aucun contenu externe ne se charge avant -->
  let isPlaying = $state(false);
</script>

{#if embedUrl}
  <Section title="La bande-annonce">
    <div class="stage" style:--thumbnail="url('{trailer.thumbnail}')">
      {#if isPlaying}
        <iframe src={embedUrl} title="Bande-annonce" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>
      {:else}
        <button type="button" aria-label="Lancer la bande-annonce" onclick={() => (isPlaying = true)}>
          <img src={trailer.thumbnail} alt="" loading="lazy" />
          <span class="play-icon"></span>
        </button>
      {/if}
    </div>
  </Section>
{/if}

<style>
  .stage {
    position: relative;
    display: flex;
    justify-content: center;
    height: 340px;
    overflow: hidden;
    border-radius: var(--radiusSmall);
    background: var(--colorInk);
  }

  .stage::before {
    content: '';
    position: absolute;
    inset: -40px;
    background: var(--thumbnail) center / cover;
    filter: blur(30px) brightness(0.45);
  }

  button,
  iframe {
    position: relative;
    height: 100%;
    max-width: 100%;
    aspect-ratio: 16 / 9;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  button img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .play-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 68px;
    height: 68px;
    margin: -34px 0 0 -34px;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.55);
    transition: background var(--transitionFast), transform var(--transitionFast);
  }

  .play-icon::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    margin: -12px 0 0 -7px;
    border-width: 12px 0 12px 20px;
    border-style: solid;
    border-color: transparent transparent transparent var(--onImage);
  }

  button:hover .play-icon {
    background: var(--colorStrawberry);
    transform: scale(1.06);
  }
</style>
