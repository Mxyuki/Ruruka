<script lang="ts">
  import type { AppNotification } from '../../api/queries/notifications';
  import Icon from '../../components/Icon.svelte';
  import NyaaButton from '../../components/NyaaButton.svelte';
  import { formatRelativeTime } from '../../lib/format';
  import { nyaaEpisodeSearchUrl } from '../../lib/nyaa';
  import { mediaPath, userPath } from '../../lib/routes';
  import { library } from '../../state/library.svelte';
  import { playback } from '../../state/playback.svelte';

  interface Props {
    notification: AppNotification;
  }

  let { notification }: Props = $props();

  // <-- AniList renvoie ses phrases de notification en anglais : on traduit les plus courantes -->
  const contextPhrases: [RegExp, string][] = [
    [/^started following you.?$/i, ' te suit maintenant.'],
    [/^sent you a message.?$/i, " t'a envoyé un message."],
    [/^mentioned you in their activity.?$/i, " t'a mentionné·e dans une activité."],
    [/^replied to your activity.?$/i, ' a répondu à ton activité.'],
    [/^replied to activity you're subscribed to.?$/i, ' a répondu à une activité que tu suis.'],
    [/^liked your activity.?$/i, ' a aimé ton activité.'],
    [/^liked your activity reply.?$/i, ' a aimé ta réponse.'],
    [/^liked your comment.?$/i, ' a aimé ton commentaire.'],
    [/^liked your forum thread.?$/i, ' a aimé ton sujet du forum.'],
    [/^mentioned you in a forum comment.?$/i, " t'a mentionné·e sur le forum."],
    [/^replied to your forum comment.?$/i, ' a répondu à ton commentaire sur le forum.'],
    [/^commented in your subscribed forum thread.?$/i, ' a commenté un sujet que tu suis.'],
    [/^was recently added to the site.?$/i, ' vient d’être ajouté sur AniList.'],
    [/^received site data changes.?$/i, ' a été mis à jour sur AniList.'],
  ];

  const translate = (text: string) => contextPhrases.find(([pattern]) => pattern.test(text.trim()))?.[1] ?? ` ${text}`;
</script>

<li>
  {#if notification.kind === 'airing'}
    {@const { media, episode } = notification}
    {@const linkedMedia = library.mediaById.get(media.id)}
    <a href="#{mediaPath(media.id)}"><img src={media.coverImage.medium} alt="" loading="lazy" /></a>
    <p>
      L'épisode <strong>{episode}</strong> de <a class="title" href="#{mediaPath(media.id)}">{media.title.userPreferred}</a> est sorti !
    </p>
    <span class="actions">
      {#if linkedMedia && library.episodesFor(media.id).has(episode)}
        <button class="btn btn-primary btn-sm" type="button" onclick={() => playback.requestPlay(linkedMedia, episode)}>
          <Icon name="play" size={12} filled /> Regarder
        </button>
      {:else}
        <NyaaButton url={nyaaEpisodeSearchUrl(media.title.romaji ?? media.title.userPreferred, episode)} />
      {/if}
    </span>
  {:else if notification.kind === 'media'}
    <a href="#{mediaPath(notification.media.id)}"><img src={notification.media.coverImage.medium} alt="" loading="lazy" /></a>
    <p><a class="title" href="#{mediaPath(notification.media.id)}">{notification.media.title.userPreferred}</a>{translate(notification.text)}</p>
    <span></span>
  {:else if notification.kind === 'user'}
    <a href="#{userPath(notification.user.name)}"><img class="avatar" src={notification.user.avatar.medium} alt="" loading="lazy" /></a>
    <p><a class="title" href="#{userPath(notification.user.name)}">{notification.user.name}</a>{translate(notification.text)}</p>
    <span></span>
  {:else}
    <span class="placeholder"><Icon name="bell" /></span>
    <p>{notification.text}</p>
    <span></span>
  {/if}
  <time class="faint">{formatRelativeTime(notification.createdAt)}</time>
</li>

<style>
  li {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto 110px;
    align-items: center;
    gap: var(--space3);
    padding: var(--space2) var(--space4) var(--space2) var(--space2);
    border-bottom: 1px solid var(--colorLine);
  }

  li:last-child {
    border-bottom: 0;
  }

  img {
    width: 44px;
    height: 60px;
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .avatar {
    height: 44px;
    border-radius: 50%;
  }

  .placeholder {
    display: flex;
    justify-content: center;
    color: var(--textFaint);
  }

  p {
    color: var(--textSoft);
  }

  .title {
    color: var(--textMain);
    font-weight: 600;
  }

  .title:hover {
    color: var(--textSoft);
  }

  strong {
    color: var(--textSoft);
  }

  time {
    font-size: var(--fontSizeXs);
    text-align: right;
  }
</style>
