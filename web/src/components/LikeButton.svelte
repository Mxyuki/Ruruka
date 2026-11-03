<script lang="ts">
  import { toggleLike, type Likeable, type LikeTarget } from '../api/queries/activity';
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';

  interface Props {
    target: Likeable;
    type: LikeTarget;
    small?: boolean;
  }

  let { target = $bindable(), type, small = false }: Props = $props();

  const maxLikersShown = 12;
  let likersPanel = $state<HTMLElement>();
  const hiddenLikers = $derived(Math.max(0, target.likeCount - Math.min(target.likes.length, maxLikersShown)));

  // <-- Le cœur change tout de suite ; la réponse d'AniList corrige l'état et le compteur, la liste des témoins reste tenue ici -->
  async function like() {
    const previous = { isLiked: target.isLiked, likeCount: target.likeCount, likes: target.likes };
    setLiked(!target.isLiked, target.likeCount + (target.isLiked ? -1 : 1));
    try {
      const result = await toggleLike(target.id, type);
      setLiked(result.isLiked, result.likeCount);
    } catch (error) {
      Object.assign(target, previous);
      toasts.error(error, type === 'ACTIVITY' ? 'Impossible d’aimer' : 'Impossible d’aimer cette réponse');
    }
  }

  function setLiked(isLiked: boolean, likeCount: number) {
    target.isLiked = isLiked;
    target.likeCount = likeCount;
    const viewer = session.viewer;
    if (!viewer) return;
    const others = target.likes.filter((user) => user.id !== viewer.id);
    target.likes = isLiked ? [...others, { id: viewer.id, name: viewer.name, avatar: { medium: viewer.avatar.medium } }] : others;
  }

  // <-- La liste passe dans la couche du dessus : les fils d'activité rognent ce qui dépasse de leur carte -->
  function showLikers(event: PointerEvent | FocusEvent) {
    if (!likersPanel || !target.likes.length) return;
    const anchor = (event.currentTarget as HTMLElement).getBoundingClientRect();
    likersPanel.style.left = `${anchor.left}px`;
    likersPanel.style.top = `${anchor.top - 6}px`;
    if (!likersPanel.matches(':popover-open')) likersPanel.showPopover();
  }

  function hideLikers() {
    if (likersPanel?.matches(':popover-open')) likersPanel.hidePopover();
  }
</script>

<span class="like-wrap">
  <button
    class="like"
    class:is-liked={target.isLiked}
    class:is-small={small}
    type="button"
    aria-pressed={target.isLiked}
    aria-label={target.isLiked ? `Je n'aime plus (${target.likeCount})` : `J'aime (${target.likeCount})`}
    data-sparkle
    onclick={like}
    onpointerenter={showLikers}
    onpointerleave={hideLikers}
    onfocus={showLikers}
    onblur={hideLikers}
  >
    {#key target.isLiked}
      <svg class="heart" viewBox="0 0 24 24" width={small ? 16 : 20} height={small ? 16 : 20} aria-hidden="true">
        <path d="M12 21 C5 15.5 2 12 2 8 C2 5 4.5 3 7 3 C9 3 11 4.2 12 6 C13 4.2 15 3 17 3 C19.5 3 22 5 22 8 C22 12 19 15.5 12 21Z" />
      </svg>
    {/key}
    {#if target.likeCount}<span class="count">{target.likeCount}</span>{/if}
  </button>

  <!-- Témoins du cœur, au survol -->
  <div class="likers" popover="manual" bind:this={likersPanel}>
    <p class="field-label">Aimé par</p>
    <ul>
      {#each target.likes.slice(0, maxLikersShown) as user (user.id)}
        <li><img src={user.avatar.medium} alt="" loading="lazy" />{user.name}</li>
      {/each}
    </ul>
    {#if hiddenLikers}<p class="faint more">et {hiddenLikers} autre{hiddenLikers > 1 ? 's' : ''}</p>{/if}
  </div>
</span>

<style>
  .like-wrap {
    display: inline-flex;
  }

  .like {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border: 0;
    border-radius: var(--radiusPill);
    background: none;
    color: var(--textSoft);
    cursor: pointer;
    font-weight: 800;
    transition: background var(--transitionFast);
  }

  .like:hover {
    background: var(--colorMauveSoft);
  }

  .is-small {
    padding: 2px 6px;
    font-size: var(--fontSizeXs);
  }

  .heart {
    fill: var(--colorPaper);
    stroke: var(--colorInk);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  /* <-- Le cœur est re-créé à chaque clic, il rebondit donc à chaque fois --> */
  .is-liked .heart {
    fill: var(--colorStrawberry);
    animation: pop 0.45s var(--easeSpring);
  }

  @keyframes pop {
    0% {
      transform: scale(0.5);
    }
    60% {
      transform: scale(1.35) rotate(-10deg);
    }
  }

  /* <-- Petite fiche posée au-dessus du cœur --> */
  .likers {
    position: fixed;
    inset: auto;
    min-width: 160px;
    max-width: 240px;
    margin: 0;
    padding: var(--space2) var(--space3);
    border: var(--outline);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    color: var(--textMain);
    pointer-events: none;
    transform: translateY(-100%);
  }

  .likers .field-label {
    margin-bottom: var(--space1);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space2);
    overflow: hidden;
    font-size: var(--fontSizeSm);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  li img {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    object-fit: cover;
  }

  .more {
    margin-top: 4px;
    font-size: var(--fontSizeXs);
  }
</style>
