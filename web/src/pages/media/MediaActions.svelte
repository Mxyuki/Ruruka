<script lang="ts">
  import { toggleMediaFavourite, type MediaDetails } from '../../api/queries/media';
  import CustomListPicker from '../../components/CustomListPicker.svelte';
  import Icon from '../../components/Icon.svelte';
  import ListEditor from '../../components/ListEditor.svelte';
  import NumberStepper from '../../components/NumberStepper.svelte';
  import NyaaButton from '../../components/NyaaButton.svelte';
  import ScoreInput from '../../components/ScoreInput.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import { formatListStatus, unitLabel, statusColor } from '../../lib/format';
  import { nyaaMediaSearchUrl } from '../../lib/nyaa';
  import { mediaList, totalUnits } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    media: MediaDetails;
  }

  let { media }: Props = $props();

  const entry = $derived(mediaList.entryFor(media.id));
  let isEditorOpen = $state(false);
  let isFavourite = $state(false);
  let isSaving = $state(false);

  $effect.pre(() => {
    isFavourite = media.isFavourite;
  });

  $effect(() => {
    mediaList.load(media.type).catch((error) => toasts.error(error, 'Impossible de charger ta liste'));
  });

  async function save(run: () => Promise<unknown>) {
    isSaving = true;
    try {
      await run();
    } catch (error) {
      toasts.error(error, "Impossible d'enregistrer");
    } finally {
      isSaving = false;
    }
  }

  const addToPlanning = () => save(() => mediaList.save(media, { status: 'PLANNING' }));
  const setProgress = (progress: number) => save(() => mediaList.save(media, { progress }));
  const setScore = (score: number) => save(() => mediaList.save(media, { score }));

  async function toggleFavourite() {
    isFavourite = !isFavourite;
    try {
      await toggleMediaFavourite(media.id, media.type);
    } catch (error) {
      isFavourite = !isFavourite;
      toasts.error(error, 'Impossible de modifier les favoris');
    }
  }
</script>

<!-- Fiche de suivi : statut, progression, note -->
<div class="tracker notebook-page">
  <i class="tape is-star"></i>
  <Sticker name="ruban" size={64} rotate={-18} position="top: -26px; left: -24px" />
  <div class="row">
    {#if entry}
      <button class="btn status" style:--status={statusColor(entry.status)} type="button" onclick={() => (isEditorOpen = true)}>
        {formatListStatus(entry.status, media.type)}
        <Icon name="chevronDown" size={14} />
      </button>
    {:else}
      <button class="btn btn-primary" type="button" disabled={isSaving} onclick={addToPlanning}>
        <Icon name="plus" size={14} /> Ajouter à ma liste
      </button>
      <button class="btn btn-ghost" type="button" onclick={() => (isEditorOpen = true)}>
        <Icon name="edit" size={14} /> Choisir un statut…
      </button>
    {/if}

    <span class="spacer"></span>

    <button
      class="btn btn-ghost btn-icon favourite"
      class:is-active={isFavourite}
      type="button"
      title={isFavourite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-pressed={isFavourite}
      data-sparkle
      onclick={toggleFavourite}
    >
      <Icon name="heart" filled={isFavourite} />
    </button>
    <NyaaButton url={nyaaMediaSearchUrl(media.title, media.type)} label="Nyaa" />
    <a class="btn btn-ghost btn-icon" href="https://anilist.co/{media.type.toLowerCase()}/{media.id}" target="_blank" rel="noopener noreferrer" title="Ouvrir sur AniList">
      <Icon name="external" size={16} />
    </a>
  </div>

  <div class="row fields">
    {#if entry}
      <div class="field">
        <span class="field-label">{unitLabel(media.type)}s vus</span>
        <NumberStepper label="progression" value={entry.progress} max={totalUnits(media)} onchange={setProgress} />
      </div>
    {/if}
    <div class="field">
      <span class="field-label">Ma note</span>
      <ScoreInput value={entry?.score ?? 0} format={session.viewer?.mediaListOptions.scoreFormat ?? 'POINT_100'} onchange={setScore} />
    </div>
  </div>

  <div class="field">
    <span class="field-label">Mes listes perso</span>
    <CustomListPicker {media} />
  </div>
</div>

<ListEditor {media} open={isEditorOpen} onclose={() => (isEditorOpen = false)} />

<style>
  .tracker {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    max-width: 740px;
    margin-top: var(--space3);
    padding: var(--space4) var(--space4) var(--space4) 48px;
  }

  .tracker .tape {
    top: -10px;
    right: 40px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .fields {
    gap: var(--space6);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .spacer {
    flex: 1;
  }

  .status {
    min-width: 150px;
    background: var(--status);
    font-family: var(--fontTitle);
    font-weight: 400;
  }

  .favourite.is-active :global(svg) {
    color: var(--colorStrawberry);
  }
</style>
