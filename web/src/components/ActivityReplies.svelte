<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchReplies, postReply, toggleLike, type ActivityReply } from '../api/queries/activity';
  import { formatRelativeTime } from '../lib/format';
  import { sanitizeHtml } from '../lib/html';
  import { userPath } from '../lib/routes';
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import LikeButton from './LikeButton.svelte';
  import TextComposer from './TextComposer.svelte';

  interface Props {
    activityId: number;
    onreplied: () => void;
  }

  let { activityId, onreplied }: Props = $props();

  let replies = $state<ActivityReply[]>([]);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      replies = await fetchReplies(activityId);
    } catch (error) {
      toasts.error(error, 'Impossible de charger les réponses');
    } finally {
      isLoading = false;
    }
  });

  async function reply(text: string) {
    try {
      replies.push(await postReply(activityId, text));
      onreplied();
    } catch (error) {
      toasts.error(error, 'Impossible d’envoyer ta réponse');
      throw error;
    }
  }

  async function like(target: ActivityReply) {
    const previous = { isLiked: target.isLiked, likeCount: target.likeCount };
    target.isLiked = !target.isLiked;
    target.likeCount += target.isLiked ? 1 : -1;
    try {
      Object.assign(target, await toggleLike(target.id, 'ACTIVITY_REPLY'));
    } catch (error) {
      Object.assign(target, previous);
      toasts.error(error, 'Impossible d’aimer cette réponse');
    }
  }
</script>

<div class="replies">
  {#if isLoading}
    <p class="faint">On recueille les témoignages…</p>
  {:else}
    {#each replies as reply (reply.id)}
      <div class="reply">
        <a href="#{userPath(reply.user.name)}"><img src={reply.user.avatar.medium} alt="" loading="lazy" /></a>
        <div class="body">
          <div class="meta">
            <a class="name" href="#{userPath(reply.user.name)}">{reply.user.name}</a>
            <time class="faint">{formatRelativeTime(reply.createdAt)}</time>
          </div>
          <div class="rich-text">{@html sanitizeHtml(reply.text)}</div>
        </div>
        <LikeButton isLiked={reply.isLiked} count={reply.likeCount} small onclick={() => like(reply)} />
      </div>
    {/each}
  {/if}
  <TextComposer placeholder="Écris une réponse…" submitLabel="Répondre" avatar={session.viewer?.avatar.medium} onsubmit={reply} />
</div>

<style>
  .replies {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    margin-top: var(--space3);
    padding: var(--space3) 0 0 var(--space4);
    border-left: 2px solid var(--colorBlond);
  }

  .reply {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    gap: var(--space2);
    align-items: start;
    animation: appear 0.25s ease-out;
  }

  img {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
  }

  .body {
    min-width: 0;
    font-size: var(--fontSizeSm);
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: var(--space2);
  }

  .name {
    font-weight: 700;
  }

  .name:hover {
    color: var(--textSoft);
  }

  time {
    font-size: var(--fontSizeXs);
  }

  .rich-text {
    color: var(--textSoft);
    overflow-wrap: anywhere;
  }

  .rich-text :global(img) {
    max-height: 220px;
  }

  @keyframes appear {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
</style>
