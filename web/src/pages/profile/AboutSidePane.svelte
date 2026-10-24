<script lang="ts">
  import { fillAboutTemplate, hasLiveTags } from '../../lib/aboutTemplate';
  import { renderAniListMarkdown } from '../../lib/markdown';
  import { liveAbout } from '../../state/liveAbout.svelte';
  import AboutGuide from './AboutGuide.svelte';
  import type { AboutSyntax } from './aboutSyntax';

  interface Props {
    /** The draft, already debounced by the editor. */
    source: string;
    oninsert: (syntax: AboutSyntax) => void;
  }

  let { source, oninsert }: Props = $props();

  let activePane = $state<'preview' | 'guide'>('preview');
  let isPreviewWatching = $state(true);

  const isLive = $derived(hasLiveTags(source));
  const previewText = $derived(isLive ? fillAboutTemplate(source, liveAbout.previewState(isPreviewWatching)) : source);
  const previewHtml = $derived(renderAniListMarkdown(previewText));
</script>

<section class="card pane">
  <div class="toolbar" role="tablist">
    <button class="chip" class:is-active={activePane === 'preview'} type="button" role="tab" aria-selected={activePane === 'preview'} onclick={() => (activePane = 'preview')}>
      Aperçu
    </button>
    <button class="chip" class:is-active={activePane === 'guide'} type="button" role="tab" aria-selected={activePane === 'guide'} onclick={() => (activePane = 'guide')}>
      Guide des balises
    </button>
  </div>

  <!-- Avec des balises en direct, on choisit l'état à prévisualiser -->
  {#if activePane === 'preview' && isLive}
    <div class="live-states">
      <span>Profil en direct :</span>
      <button class="chip" class:is-active={isPreviewWatching} type="button" onclick={() => (isPreviewWatching = true)}>Pendant un épisode</button>
      <button class="chip" class:is-active={!isPreviewWatching} type="button" onclick={() => (isPreviewWatching = false)}>Au repos</button>
    </div>
  {/if}

  <div class="scroll">
    {#if activePane === 'guide'}
      <AboutGuide {oninsert} />
    {:else if previewHtml}
      <div class="rich-text preview">{@html previewHtml}</div>
    {:else}
      <p class="placeholder">L’aperçu de ton dossier apparaîtra ici.</p>
    {/if}
  </div>
</section>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .toolbar,
  .live-states {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
    padding: var(--space3) var(--space4);
    border-bottom: var(--outlineThin);
    background: var(--colorSunken);
  }

  .live-states {
    background: var(--colorSkySoft);
    font-size: var(--fontSizeSm);
    font-weight: 800;
  }

  .scroll {
    flex: 1;
    padding: var(--space4) var(--space5);
    overflow-y: auto;
  }

  .preview {
    color: var(--textSoft);
  }

  .placeholder {
    color: var(--textFaint);
    font-family: var(--fontHand);
    font-size: var(--fontSizeLg);
  }
</style>
