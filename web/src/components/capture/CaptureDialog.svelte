<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { invoke, type CaptureOffer, type ClipFormat, type ClipQuality } from '../../lib/bridge';
  import { fitRatio, fullFrame, isFullFrame, type CropRect } from '../../lib/cropRect';
  import { formatClock } from '../../lib/format';
  import { capture } from '../../state/capture.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import Icon from '../Icon.svelte';
  import LoadingState from '../LoadingState.svelte';
  import Modal from '../Modal.svelte';
  import Toggle from '../Toggle.svelte';
  import ClipControls from './ClipControls.svelte';
  import CropFrame from './CropFrame.svelte';
  import ClipPreview from './ClipPreview.svelte';
  import { freeShape, shapes, type Shape } from './cropShapes';
  import { blobToBase64, cropToPng, pngFromBase64 } from './frameExport';

  let { offer }: { offer: CaptureOffer } = $props();

  type Tab = 'image' | 'clip';

  const maxClipSeconds = 300;
  const maxPreviewSeconds = 60;
  const defaultClipSeconds = 10;

  let tab = $state<Tab>('image');
  // <-- L'atelier est recréé à chaque nouvelle capture : les valeurs de départ viennent de celle-ci -->
  const firstOffer = untrack(() => offer);
  let withSubtitles = $state(firstOffer.hasSubtitles);
  let crop = $state<CropRect>(fullFrame);
  let shape = $state<Shape>(freeShape);
  let naturalWidth = $state(0);
  let naturalHeight = $state(0);
  let frameUrls = $state<{ plain: string; subtitled: string | null } | null>(null);
  let isWorking = $state(false);
  let startSeconds = $state(Math.max(0, firstOffer.positionSeconds - defaultClipSeconds));
  let endSeconds = $state(firstOffer.positionSeconds);
  let quality = $state<ClipQuality>('max');
  let format = $state<ClipFormat>('mp4');

  const shownUrl = $derived(frameUrls && withSubtitles && frameUrls.subtitled ? frameUrls.subtitled : (frameUrls?.plain ?? null));
  // <-- Le clip se coupe dans le fichier de l'épisode : un flux de séance ou le réglage « clip » coupé le ferment -->
  const canClip = $derived(offer.canClip && (session.settings?.isClipEnabled ?? true));
  const isTooLong = $derived(endSeconds - startSeconds > maxClipSeconds);
  const outputSize = $derived(`${Math.round(crop.width * naturalWidth)} × ${Math.round(crop.height * naturalHeight)} px`);
  const fileName = $derived(`${offer.title} - épisode ${offer.episode} - ${formatClock(offer.positionSeconds).replace(':', '.')}`);

  // <-- Les deux images (avec et sans sous-titres) arrivent une fois ; elles sont libérées à la fermeture -->
  onMount(() => {
    let isCurrent = true;
    const urls: string[] = [];
    const load = async (hasSubtitles: boolean): Promise<string | null> => {
      const base64 = await capture.loadFrame(hasSubtitles);
      if (!base64) return null;
      const url = URL.createObjectURL(await pngFromBase64(base64));
      urls.push(url);
      return url;
    };
    Promise.all([load(false), firstOffer.hasSubtitles ? load(true) : Promise.resolve(null)])
      .then(([plain, subtitled]) => {
        if (isCurrent && plain) frameUrls = { plain, subtitled };
      })
      .catch((error) => toasts.error(error, 'Impossible d’afficher l’image'));
    return () => {
      isCurrent = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  function chooseShape(next: Shape) {
    shape = next;
    if (next.ratio !== null && naturalWidth) crop = fitRatio(crop, (next.ratio * naturalHeight) / naturalWidth);
  }

  function resetCrop() {
    crop = fullFrame;
    shape = freeShape;
  }

  async function exportImage(): Promise<Blob | null> {
    if (!shownUrl) return null;
    try {
      return await cropToPng(shownUrl, crop);
    } catch (error) {
      toasts.error(error, 'Impossible de préparer l’image');
      return null;
    }
  }

  async function copyImage() {
    isWorking = true;
    try {
      const blob = await exportImage();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toasts.success('Image copiée : colle-la dans ta conversation !');
    } catch (error) {
      toasts.error(error, 'Impossible de copier l’image');
    } finally {
      isWorking = false;
    }
  }

  async function saveImage() {
    isWorking = true;
    try {
      const blob = await exportImage();
      if (!blob) return;
      if (await invoke('shell.saveImage', { fileName: `${fileName}.png`, pngBase64: await blobToBase64(blob) })) toasts.success('Image enregistrée.');
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer l’image');
    } finally {
      isWorking = false;
    }
  }

  function cutClip() {
    void capture.saveClip({
      startSeconds,
      endSeconds,
      crop: isFullFrame(crop) ? null : crop,
      withSubtitles,
      quality,
      format,
      fileName,
    });
  }

  function open(path: string) {
    invoke('shell.openPath', { path }).catch((error) => toasts.error(error, 'Impossible d’ouvrir ce fichier'));
  }
</script>

<Modal open title="Atelier de capture" width="900px" onclose={() => capture.close()}>
  <div class="tabs">
    <button class="chip" class:is-active={tab === 'image'} type="button" onclick={() => (tab = 'image')}>Image</button>
    <button
      class="chip"
      class:is-active={tab === 'clip'}
      type="button"
      disabled={!canClip}
      title={canClip ? undefined : 'Un clip se découpe dans un fichier de ta bibliothèque, et seulement si l’option est active dans les réglages'}
      onclick={() => (tab = 'clip')}
    >
      Clip
    </button>
    <span class="where">{offer.title} · épisode {offer.episode} · {formatClock(offer.positionSeconds)}</span>
  </div>

  {#if shownUrl}
    <CropFrame src={shownUrl} bind:crop ratio={shape.ratio} bind:naturalWidth bind:naturalHeight />
  {:else}
    <LoadingState />
  {/if}

  <div class="options">
    <span class="note-label">Cadrage</span>
    {#each shapes as option (option.key)}
      <button class="chip" class:is-active={shape.key === option.key} type="button" onclick={() => chooseShape(option)}>{option.label}</button>
    {/each}
    <button class="btn btn-ghost btn-sm" type="button" disabled={isFullFrame(crop)} onclick={resetCrop}>Tout l’écran</button>
    {#if offer.hasSubtitles}
      <Toggle checked={withSubtitles} label="Sous-titres" onchange={(checked) => (withSubtitles = checked)} />
    {/if}
    <span class="size">{outputSize}</span>
  </div>

  {#if tab === 'clip'}
    <ClipControls bind:startSeconds bind:endSeconds bind:quality bind:format positionSeconds={offer.positionSeconds} durationSeconds={offer.durationSeconds} />
    {#if isTooLong}<p class="warning">Un clip dure 5 minutes au plus : raccourcis l’extrait.</p>{/if}
    <ClipPreview request={{ startSeconds, endSeconds, crop: isFullFrame(crop) ? null : crop, withSubtitles }} maxSeconds={maxPreviewSeconds} />
  {/if}

  {#snippet footer()}
    {#if tab === 'image'}
      <button class="btn btn-ghost" type="button" disabled={!shownUrl || isWorking} onclick={saveImage}>
        <Icon name="download" size={14} /> Enregistrer…
      </button>
      <button class="btn btn-primary" type="button" disabled={!shownUrl || isWorking} onclick={copyImage}>
        <Icon name="copy" size={14} /> Copier l’image
      </button>
    {:else if capture.isCutting}
      <progress max="1" value={capture.cutRatio}></progress>
      <button class="btn btn-ghost" type="button" onclick={() => capture.cancelClip()}>Annuler</button>
    {:else}
      {#if capture.savedClip}
        <button class="btn btn-ghost" type="button" onclick={() => open(capture.savedClip!.folder)}>Ouvrir le dossier</button>
        <button class="btn btn-ghost" type="button" onclick={() => open(capture.savedClip!.path)}>Voir le clip</button>
      {/if}
      <button class="btn btn-primary" type="button" disabled={!shownUrl || isTooLong} onclick={cutClip}>
        <Icon name="download" size={14} /> {capture.savedClip ? 'Découper à nouveau' : 'Découper le clip'}
      </button>
    {/if}
  {/snippet}
</Modal>

<style>
  .tabs,
  .options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
    margin: var(--space3) 0;
  }

  .chip {
    border: 0;
    cursor: pointer;
  }

  .chip:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .where {
    margin-left: auto;
    color: var(--textSoft);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
  }

  .size {
    margin-left: auto;
    color: var(--textSoft);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .warning {
    margin: var(--space2) 0 0;
    color: var(--textSoft);
    font-weight: 800;
  }

  progress {
    flex: 1;
    accent-color: var(--colorStar);
  }
</style>
