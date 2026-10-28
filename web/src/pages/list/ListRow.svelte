<script lang="ts">
  import type { PublicListEntry } from '../../api/types';
  import Icon from '../../components/Icon.svelte';
  import { formatEnum, formatUserScore, statusColor } from '../../lib/format';
  import { mediaPath } from '../../lib/routes';
  import { library } from '../../state/library.svelte';
  import { mediaList, totalUnits } from '../../state/mediaList.svelte';
  import { playback } from '../../state/playback.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    entry: PublicListEntry;
    /** Missing on someone else's list: the row is then read-only. */
    onedit?: () => void;
  }

  let { entry, onedit }: Props = $props();

  const media = $derived(entry.media);
  const total = $derived(totalUnits(media));
  const nextEpisode = $derived(entry.progress + 1);
  const isEditable = $derived(Boolean(onedit));
  const canPlayNext = $derived(isEditable && media.type === 'ANIME' && library.episodesFor(media.id).has(nextEpisode));
  let isSaving = $state(false);

  async function increment() {
    isSaving = true;
    try {
      await mediaList.save(media, { progress: nextEpisode });
    } catch (error) {
      toasts.error(error, 'Impossible de mettre à jour la progression');
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="row">
  <span class="status-bar" style:background={statusColor(entry.status)}></span>
  <a href="#{mediaPath(media.id)}" class="cover"><img src={media.coverImage.medium} alt="" loading="lazy" width="40" height="56" /></a>
  <a href="#{mediaPath(media.id)}" class="title">{media.title.userPreferred}</a>
  <span class="format">{formatEnum(media.format)}</span>
  <span class="score">{formatUserScore(entry.score, session.viewer?.mediaListOptions.scoreFormat ?? 'POINT_100')}</span>
  <span class="progress">
    {entry.progress}{total ? ` / ${total}` : ''}
    {#if isEditable && (!total || entry.progress < total)}
      <button class="btn btn-ghost btn-sm" type="button" title="+1" disabled={isSaving} onclick={increment}><Icon name="plus" size={12} /></button>
    {/if}
  </span>
  <span class="actions">
    {#if canPlayNext}
      <button class="btn btn-ghost btn-sm" type="button" title="Regarder l'épisode {nextEpisode}" onclick={() => playback.requestPlay(media, nextEpisode)}>
        <Icon name="play" size={14} filled />
      </button>
    {/if}
    {#if onedit}
      <button class="btn btn-ghost btn-sm" type="button" title="Modifier" onclick={onedit}><Icon name="edit" size={14} /></button>
    {/if}
  </span>
</div>

<style>
  /* <-- Chaque dossier est une bande de papier cernée d'encre, avec une pastille de statut --> */
  .row {
    display: grid;
    grid-template-columns: 16px 40px minmax(0, 1fr) 90px 70px 120px 80px;
    align-items: center;
    gap: var(--space3);
    padding: 6px var(--space3);
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorPaper);
    content-visibility: auto;
    contain-intrinsic-size: auto 72px;
    transition: transform 0.2s var(--easeSpring), box-shadow var(--transitionFast);
  }

  .row:hover {
    box-shadow: var(--stickerShadow);
    transform: translate(-1px, -1px);
  }

  .status-bar {
    width: 14px;
    height: 14px;
    border: var(--outlineThin);
    border-radius: 50%;
  }

  .cover img {
    border: var(--outlineThin);
    border-radius: 6px;
    object-fit: cover;
  }

  .title {
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title:hover {
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }

  .format {
    font-family: var(--fontHand);
    font-size: 1.7rem;
    text-align: center;
  }

  .score {
    font-family: var(--fontTitle);
    text-align: center;
  }

  .progress {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space1);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
