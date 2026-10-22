<script lang="ts">
  import type { Snippet } from 'svelte';
  import ArtSlot from './ArtSlot.svelte';

  interface Props {
    title: string;
    message?: string;
    children?: Snippet;
  }

  let { title, message, children }: Props = $props();
</script>

<div class="empty">
  <ArtSlot name="vide.png" width={110} height={209} />
  <!-- Bulle de Mashutan -->
  <div class="bubble">
    <h3>{title}</h3>
    {#if message}<p>{message}</p>{/if}
    {#if children}<div class="actions">{@render children()}</div>{/if}
    <small>— Mashutan</small>
  </div>
</div>

<style>
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space5);
    padding: var(--space7) var(--space4);
  }

  .bubble {
    position: relative;
    max-width: 440px;
    padding: var(--space4) var(--space5);
    border: var(--outline);
    border-radius: var(--radiusLarge);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    transform: rotate(-1deg);
  }

  .bubble::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -11px;
    width: 18px;
    height: 18px;
    border-bottom: var(--outline);
    border-left: var(--outline);
    background: var(--colorPaper);
    transform: translateY(-50%) rotate(45deg);
  }

  h3 {
    font-family: var(--fontTitle);
    font-size: var(--fontSizeLg);
    font-weight: 400;
  }

  p {
    margin-top: 4px;
    color: var(--textSoft);
  }

  small {
    display: block;
    margin-top: var(--space2);
    color: var(--colorPlum);
    font-family: var(--fontHand);
    font-size: 1.6rem;
    text-align: right;
  }

  .actions {
    display: flex;
    gap: var(--space2);
    margin-top: var(--space3);
  }
</style>
