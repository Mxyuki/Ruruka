<script lang="ts">
  import { untrack } from 'svelte';
  import type { ClipPreviewRequest } from '../../lib/bridge';
  import { capture } from '../../state/capture.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import Icon from '../Icon.svelte';
  import { mp4FromBase64 } from './frameExport';

  interface Props {
    request: ClipPreviewRequest;
    /** The host cuts at most this many seconds for a preview. */
    maxSeconds: number;
  }

  let { request, maxSeconds }: Props = $props();

  let previewUrl = $state<string | null>(null);
  let isLoading = $state(false);

  const isTruncated = $derived(request.endSeconds - request.startSeconds > maxSeconds);
  const signature = $derived(JSON.stringify(request));

  // <-- Dès que les bornes, le cadrage ou les sous-titres changent, l'ancien aperçu ne dit plus la vérité -->
  $effect(() => {
    void signature;
    untrack(release);
  });

  $effect(() => release);

  function release() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  async function showPreview() {
    isLoading = true;
    try {
      const base64 = await capture.loadPreview(request);
      if (!base64) return;
      release();
      previewUrl = URL.createObjectURL(await mp4FromBase64(base64));
    } catch (error) {
      toasts.error(error, 'Impossible de préparer l’aperçu');
    } finally {
      isLoading = false;
    }
  }
</script>

<!-- Aperçu : le vrai extrait, avec cadrage et sous-titres, en petit format -->
<div class="preview">
  <div class="head">
    <button class="btn btn-sm" type="button" disabled={isLoading} onclick={showPreview}>
      <Icon name="play" size={14} /> {previewUrl ? 'Rafraîchir l’aperçu' : 'Voir l’aperçu'}
    </button>
    {#if isLoading}<span class="note" role="status">On prépare l’extrait…</span>{/if}
    {#if isTruncated}<span class="note">L’aperçu montre la première minute ; le clip sera entier.</span>{/if}
  </div>
  {#if previewUrl}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video src={previewUrl} controls autoplay loop></video>
  {/if}
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .note {
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
    font-weight: 700;
  }

  video {
    width: 100%;
    max-height: 260px;
    border: var(--outline);
    border-radius: var(--radiusSmall);
    background: var(--colorInk);
  }
</style>
