<script lang="ts">
  import type { MediaDetails } from '../../api/queries/media';
  import type { ListEntry } from '../../api/types';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import Modal from '../../components/Modal.svelte';
  import { invoke } from '../../lib/bridge';
  import { formatListStatus, formatScoreOutOf } from '../../lib/format';
  import { totalUnits } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import { renderShareCard, type ShareCardContent } from './shareCard';

  interface Props {
    open: boolean;
    media: MediaDetails;
    entry: ListEntry;
    onclose: () => void;
  }

  let { open, media, entry, onclose }: Props = $props();

  let image = $state<{ blob: Blob; url: string } | null>(null);
  let isWorking = $state(false);

  function contentFor(): ShareCardContent {
    const total = totalUnits(media);
    const isManga = media.type === 'MANGA';
    const plural = Math.max(total ?? 0, entry.progress) > 1 ? 's' : '';
    return {
      title: media.title.userPreferred,
      altTitle: media.title.english && media.title.english !== media.title.userPreferred ? media.title.english : null,
      coverUrl: media.coverImage.extraLarge,
      bannerUrl: media.bannerImage,
      progress: total ? `${entry.progress}/${total}` : String(entry.progress),
      progressLabel: isManga ? `chapitre${plural} lu${plural}` : `épisode${plural} vu${plural}`,
      statusLabel: formatListStatus(entry.status, media.type),
      isCompleted: entry.status === 'COMPLETED',
      score: entry.score ? formatScoreOutOf(entry.score, session.scoreFormat) : null,
    };
  }

  // <-- La carte est redessinée à chaque ouverture, pour suivre la note et la progression du moment -->
  $effect(() => {
    if (!open) return;
    let isCurrent = true;
    renderShareCard(contentFor())
      .then((blob) => {
        if (isCurrent) image = { blob, url: URL.createObjectURL(blob) };
      })
      .catch((error) => {
        toasts.error(error, 'Impossible de dessiner la carte');
        onclose();
      });
    return () => {
      isCurrent = false;
      if (image) URL.revokeObjectURL(image.url);
      image = null;
    };
  });

  async function copy() {
    if (!image) return;
    isWorking = true;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image.blob })]);
      toasts.success('Carte copiée : colle-la dans ta conversation !');
    } catch (error) {
      toasts.error(error, 'Impossible de copier l’image');
    } finally {
      isWorking = false;
    }
  }

  async function save() {
    if (!image) return;
    isWorking = true;
    try {
      const bytes = new Uint8Array(await image.blob.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const fileName = `${media.title.userPreferred} - Ruruka.png`;
      if (await invoke('shell.saveImage', { fileName, pngBase64: btoa(binary) })) toasts.success('Carte enregistrée.');
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer l’image');
    } finally {
      isWorking = false;
    }
  }
</script>

<Modal {open} title="Partager ma fiche" width="760px" {onclose}>
  {#if image}
    <img class="preview" src={image.url} alt="Carte de {media.title.userPreferred} : {entry.progress} {media.type === 'MANGA' ? 'chapitres' : 'épisodes'}" />
  {:else}
    <LoadingState />
  {/if}

  {#snippet footer()}
    <button class="btn btn-ghost" type="button" disabled={!image || isWorking} onclick={save}>
      <Icon name="download" size={14} /> Enregistrer…
    </button>
    <button class="btn btn-primary" type="button" disabled={!image || isWorking} onclick={copy}>
      <Icon name="copy" size={14} /> Copier l’image
    </button>
  {/snippet}
</Modal>

<style>
  /* <-- Le cadre et l'ombre sont dans le PNG : l'aperçu montre exactement ce qui sera copié --> */
  .preview {
    display: block;
    width: 100%;
  }
</style>
