<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  interface Props {
    open: boolean;
    title: string;
    width?: string;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open, title, width = '540px', onclose, children, footer }: Props = $props();
  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === dialog) onclose();
  }
</script>

<!-- Feuille de carnet scotchée au-dessus de la page -->
<dialog bind:this={dialog} style:width onclose={onclose} onclick={closeOnBackdrop}>
  {#if open}
    <i class="tape"></i>
    <header>
      <h2>{title}</h2>
      <button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Fermer" onclick={onclose}>
        <Icon name="close" size={16} />
      </button>
    </header>
    <div class="body">{@render children()}</div>
    {#if footer}
      <footer>{@render footer()}</footer>
    {/if}
  {/if}
</dialog>

<style>
  dialog {
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    padding: 0;
    overflow: visible;
    border: var(--outline);
    border-radius: var(--radiusLarge);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadowLarge);
    color: var(--textMain);
  }

  dialog[open] {
    animation: drop-in 0.35s var(--easeSpring);
  }

  dialog::backdrop {
    background: var(--colorOverlay);
  }

  .tape {
    top: -11px;
    left: calc(50% - 37px);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space3);
    padding: var(--space5) var(--space5) var(--space3);
  }

  h2 {
    font-size: var(--fontSizeLg);
  }

  .body {
    max-height: calc(100vh - 220px);
    padding: var(--space2) var(--space5) var(--space5);
    overflow-y: auto;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space2);
    padding: var(--space4) var(--space5);
    border-top: 2px dashed var(--colorLineStrong);
  }

  @keyframes drop-in {
    from {
      opacity: 0;
      transform: translateY(-16px) rotate(-2deg);
    }
  }
</style>
