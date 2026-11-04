<script lang="ts">
  import { groupWatch, type WatchMode } from '../../state/groupWatch.svelte';
  import { watchStream } from '../../state/watchStream.svelte';

  const modes: { mode: WatchMode; title: string; description: string }[] = [
    { mode: 'screen', title: 'Partage d’écran', description: 'Tu partages la fenêtre sur Discord ou ailleurs.' },
    { mode: 'files', title: 'Chacun son fichier', description: 'Ceux qui ont l’épisode le lancent en même temps que toi, en pleine qualité.' },
    { mode: 'stream', title: 'Flux direct', description: 'Ton PC envoie la vidéo à ceux que tu acceptes. Chacun choisit ses sous-titres.' },
  ];

  function choose(mode: WatchMode) {
    if (mode === groupWatch.mode) return;
    if (mode === 'stream') {
      void watchStream.startSharing();
      return;
    }
    if (groupWatch.mode === 'stream') watchStream.stopSharing();
    groupWatch.setMode(mode);
  }
</script>

<div class="modes" role="radiogroup" aria-label="Comment tes amis regardent">
  {#each modes as { mode, title, description } (mode)}
    <button class="mode" class:is-active={groupWatch.mode === mode} type="button" role="radio" aria-checked={groupWatch.mode === mode} onclick={() => choose(mode)}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  {/each}
</div>

<style>
  .modes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: var(--space2);
    width: 100%;
  }

  .mode {
    display: grid;
    align-content: start;
    gap: var(--space1);
    padding: var(--space3);
    border: var(--outlineThin);
    border-radius: var(--radiusSticker);
    background: var(--colorPaper);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .mode:hover {
    background: var(--colorSunken);
  }

  .mode.is-active {
    background: var(--colorBlond);
    box-shadow: var(--stickerShadow);
  }

  span {
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  .mode.is-active span {
    color: inherit;
  }
</style>
