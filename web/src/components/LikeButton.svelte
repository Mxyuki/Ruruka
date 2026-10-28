<script lang="ts">
  interface Props {
    isLiked: boolean;
    count: number;
    small?: boolean;
    onclick: () => void;
  }

  let { isLiked, count, small = false, onclick }: Props = $props();
</script>

<button
  class="like"
  class:is-liked={isLiked}
  class:is-small={small}
  type="button"
  aria-pressed={isLiked}
  aria-label={isLiked ? `Je n'aime plus (${count})` : `J'aime (${count})`}
  data-sparkle
  {onclick}
>
  {#key isLiked}
    <svg class="heart" viewBox="0 0 24 24" width={small ? 16 : 20} height={small ? 16 : 20} aria-hidden="true">
      <path d="M12 21 C5 15.5 2 12 2 8 C2 5 4.5 3 7 3 C9 3 11 4.2 12 6 C13 4.2 15 3 17 3 C19.5 3 22 5 22 8 C22 12 19 15.5 12 21Z" />
    </svg>
  {/key}
  {#if count}<span class="count">{count}</span>{/if}
</button>

<style>
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
</style>
