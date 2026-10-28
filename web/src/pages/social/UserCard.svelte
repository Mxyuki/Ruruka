<script lang="ts">
  import type { SocialUser } from '../../api/queries/social';
  import { userPath } from '../../lib/routes';

  interface Props {
    user: SocialUser;
    badge: string | null;
    isFollowing: boolean;
    ontoggle: () => void;
  }

  let { user, badge, isFollowing, ontoggle }: Props = $props();
</script>

<div class="card user">
  <a href="#{userPath(user.name)}"><img src={user.avatar.medium} alt="" loading="lazy" /></a>
  <div class="info">
    <a class="name" href="#{userPath(user.name)}">{user.name}</a>
    {#if badge}<span class="badge">{badge}</span>{/if}
  </div>
  <button class="btn btn-sm" class:btn-primary={!isFollowing} class:btn-ghost={isFollowing} type="button" onclick={ontoggle}>
    {isFollowing ? 'Ne plus suivre' : 'Suivre'}
  </button>
</div>

<style>
  .user {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space3);
    padding: var(--space2) var(--space3);
    content-visibility: auto;
    contain-intrinsic-size: auto 60px;
  }

  img {
    width: 44px;
    height: 44px;
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }

  .name {
    max-width: 100%;
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name:hover {
    color: var(--textSoft);
  }

  .badge {
    padding: 0 8px;
    border-radius: var(--radiusPill);
    background: var(--colorBlond);
    color: var(--textSoft);
    font-size: var(--fontSizeXs);
    font-weight: 600;
  }
</style>
