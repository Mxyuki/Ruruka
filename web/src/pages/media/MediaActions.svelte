<script lang="ts">
  import { toggleMediaFavourite, type MediaDetails } from '../../api/queries/media';
  import CustomListPicker from '../../components/CustomListPicker.svelte';
  import Icon from '../../components/Icon.svelte';
  import ListEditor from '../../components/ListEditor.svelte';
  import NumberStepper from '../../components/NumberStepper.svelte';
  import SearchSiteButton from '../../components/SearchSiteButton.svelte';
  import ScoreInput from '../../components/ScoreInput.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import { formatListStatus, unitLabel, statusColor } from '../../lib/format';
  import { mediaSearchUrl } from '../../lib/searchSite';
  import { siteName } from '../../lib/siteAddress';
  import { mediaList, totalUnits } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    media: MediaDetails;
    onread?: () => void;
  }

  let { media, onread }: Props = $props();

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
  const setVolumes = (progressVolumes: number) => save(() => mediaList.save(media, { progressVolumes }));
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
    <!-- Avec un site de lecture dans les réglages, les manga se lisent dans Ruruka ; sinon, le site de recherche prend le relais -->
    {#if media.type === 'MANGA' && onread && session.mangaSite}
      <button class="chapters" type="button" title="Lire les chapitres sur {siteName(session.mangaSite)}" onclick={onread}>
        <img src="{session.mangaSite}/favicon.ico" alt="" width="18" height="18" />
        <span>Chapitres</span>
      </button>
    {:else}
      <SearchSiteButton searchUrl={(site) => mediaSearchUrl(site, media.title, media.type)} label="Rechercher" />
    {/if}
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
      {#if media.type === 'MANGA'}
        <div class="field">
          <span class="field-label">Volumes vus</span>
          <NumberStepper label="volumes" value={entry.progressVolumes ?? 0} max={media.volumes} onchange={setVolumes} />
        </div>
      {/if}
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
  /* <-- Même pastille que le bouton de recherche, pour garder la rangée d'actions régulière --> */
  .chapters {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border: var(--outline);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    box-shadow: 2px 2px 0 var(--colorInk);
    color: var(--textMain);
    cursor: pointer;
    font-family: var(--fontText);
    font-size: var(--fontSizeSm);
    font-weight: 800;
    transition: transform 0.2s var(--easeSpring);
  }

  .chapters:hover {
    transform: rotate(-3deg) scale(1.05);
  }

  .chapters img {
    border-radius: 3px;
  }

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
