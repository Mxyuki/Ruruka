<script lang="ts">
  import { deleteActivity, type Activity } from '../api/queries/activity';
  import { formatRelativeTime, formatScoreOutOf } from '../lib/format';
  import { sanitizeHtml } from '../lib/html';
  import { mediaPath, userPath } from '../lib/routes';
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import ActivityMenu from './ActivityMenu.svelte';
  import ActivityReplies from './ActivityReplies.svelte';
  import Icon from './Icon.svelte';
  import LikeButton from './LikeButton.svelte';
  import StatusEditor from './StatusEditor.svelte';

  interface Props {
    activity: Activity;
    /** Tighter layout for side columns. */
    compact?: boolean;
    /** Called once the viewer has deleted this activity. */
    ondeleted?: () => void;
  }

  let { activity = $bindable(), compact = false, ondeleted }: Props = $props();

  let showsReplies = $state(false);
  let isEditing = $state(false);
  const isOwn = $derived(activity.user.id === session.viewer?.id);

  // <-- AniList renvoie ses phrases d'activité en anglais : on traduit les plus courantes -->
  const statusPhrases: Record<string, [single: string, range: string]> = {
    'watched episode': ["a regardé l'épisode", 'a regardé les épisodes'],
    'rewatched episode': ["a revu l'épisode", 'a revu les épisodes'],
    'read chapter': ['a lu le chapitre', 'a lu les chapitres'],
    'reread chapter': ['a relu le chapitre', 'a relu les chapitres'],
    completed: ['a terminé', 'a terminé'],
    'plans to watch': ['veut regarder', 'veut regarder'],
    'plans to read': ['veut lire', 'veut lire'],
    dropped: ['a abandonné', 'a abandonné'],
    'paused watching': ['a mis en pause', 'a mis en pause'],
    'paused reading': ['a mis en pause', 'a mis en pause'],
    rewatched: ['a revu', 'a revu'],
    reread: ['a relu', 'a relu'],
  };

  function describe(list: Extract<Activity, { kind: 'list' }>): string {
    const phrase = statusPhrases[list.status.toLowerCase()];
    const isRange = Boolean(list.progress?.includes('-'));
    const verb = phrase ? phrase[isRange ? 1 : 0] : list.status;
    return list.progress ? `${verb} ${list.progress} de` : verb;
  }

  async function remove(): Promise<boolean> {
    try {
      await deleteActivity(activity.id);
      ondeleted?.();
      return true;
    } catch (error) {
      toasts.error(error, 'Impossible de supprimer cette activité');
      return false;
    }
  }

  function saveText(html: string) {
    if (activity.kind === 'text') activity.text = html;
    isEditing = false;
  }
</script>

<article class="activity" class:is-compact={compact}>
  <a class="avatar" href="#{userPath(activity.user.name)}"><img src={activity.user.avatar.medium} alt="" loading="lazy" /></a>

  <div class="body">
    <div class="meta">
      <a class="name" href="#{userPath(activity.user.name)}">{activity.user.name}</a>
      <time class="faint" datetime={new Date(activity.createdAt * 1000).toISOString()}>{formatRelativeTime(activity.createdAt)}</time>
      {#if isOwn}
        <span class="menu"><ActivityMenu canEdit={activity.kind === 'text'} onedit={() => (isEditing = true)} ondelete={remove} /></span>
      {/if}
    </div>

    {#if activity.kind === 'list'}
      <p class="sentence">
        {describe(activity)}
        <a class="media-link" href="#{mediaPath(activity.media.id)}">{activity.media.title.userPreferred}</a>
        <!-- La note du dossier résolu, posée comme un tampon -->
        {#if activity.score}
          <span class="score" title="Note de {activity.user.name}">{formatScoreOutOf(activity.score, session.scoreFormat)}</span>
        {/if}
      </p>
    {:else if isEditing}
      <StatusEditor activityId={activity.id} onsaved={saveText} oncancel={() => (isEditing = false)} />
    {:else}
      <div class="rich-text text">{@html sanitizeHtml(activity.text)}</div>
    {/if}

    <div class="actions">
      <LikeButton bind:target={activity} type="ACTIVITY" />
      <button class="reply-toggle" class:is-open={showsReplies} type="button" aria-expanded={showsReplies} onclick={() => (showsReplies = !showsReplies)}>
        <Icon name="chat" size={16} />
        {activity.replyCount || ''}
        <span class="visually-hidden">réponses</span>
      </button>
    </div>

    {#if showsReplies}
      <ActivityReplies activityId={activity.id} onreplied={() => activity.replyCount++} />
    {/if}
  </div>

  {#if activity.kind === 'list'}
    <a class="cover" href="#{mediaPath(activity.media.id)}" aria-label={activity.media.title.userPreferred}>
      <img src={compact ? activity.media.coverImage.medium : activity.media.coverImage.large} alt="" loading="lazy" />
    </a>
  {/if}
</article>

<style>
  .activity {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    gap: var(--space3);
    padding: var(--space4);
    border-bottom: 1px solid var(--colorLine);
    content-visibility: auto;
    contain-intrinsic-size: auto 110px;
    transition: background var(--transitionFast);
  }

  .activity:last-child {
    border-bottom: 0;
  }

  .activity:hover {
    background: var(--colorMauveSoft);
  }

  .is-compact {
    grid-template-columns: 34px minmax(0, 1fr) auto;
    padding: var(--space3);
  }

  .avatar img {
    width: 100%;
    aspect-ratio: 1;
    border: 1px solid var(--colorLineStrong);
    border-radius: 50%;
    object-fit: cover;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: var(--space2);
  }

  .name {
    font-weight: 700;
  }

  .menu {
    margin: -4px -6px -4px auto;
  }

  .name:hover,
  .media-link:hover {
    color: var(--textSoft);
  }

  time {
    font-size: var(--fontSizeXs);
  }

  .sentence {
    color: var(--textSoft);
  }

  .sentence::first-letter {
    text-transform: uppercase;
  }

  .media-link {
    color: var(--textMain);
    font-weight: 700;
  }

  .score {
    display: inline-block;
    margin-left: 6px;
    padding: 0 8px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorStar);
    color: var(--textMain);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
    font-weight: 700;
    white-space: nowrap;
    transform: rotate(-3deg);
  }

  /* <-- Un long post défile dans sa carte au lieu d'être coupé --> */
  .text {
    max-height: 320px;
    overflow-y: auto;
    color: var(--textMain);
    overflow-wrap: anywhere;
  }

  .is-compact .text {
    display: -webkit-box;
    max-height: none;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .text :global(img) {
    max-height: 260px;
    border-radius: var(--radiusSmall);
  }

  .actions {
    display: flex;
    gap: var(--space1);
    margin-left: -10px;
  }

  .reply-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 0;
    border-radius: var(--radiusPill);
    background: none;
    color: var(--textFaint);
    cursor: pointer;
    font-size: var(--fontSizeSm);
    font-weight: 700;
    transition: color var(--transitionFast), background var(--transitionFast);
  }

  .reply-toggle:hover,
  .reply-toggle.is-open {
    background: var(--colorSkySoft);
    color: var(--textSoft);
  }

  .cover img {
    width: 56px;
    aspect-ratio: 2 / 3;
    border-radius: var(--radiusSmall);
    object-fit: cover;
    box-shadow: var(--stickerShadow);
    transition: transform 0.25s var(--easeSpring);
  }

  .is-compact .cover img {
    width: 38px;
  }

  .cover:hover img {
    transform: rotate(3deg) scale(1.05);
  }
</style>
