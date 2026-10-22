<script lang="ts">
  import { toasts } from '../state/toasts.svelte';
  import Icon from './Icon.svelte';
</script>

<!-- Les messages sont des bulles de Mashutan -->
<div class="toasts" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div class="toast is-{toast.kind}" role={toast.kind === 'error' ? 'alert' : 'status'}>
      <p class="message">{toast.message}</p>
      <div class="footer">
        <small>— Mashutan</small>
        {#if toast.action}
          {@const action = toast.action}
          <button
            class="btn btn-primary btn-sm"
            type="button"
            onclick={() => {
              action.run();
              toasts.dismiss(toast.id);
            }}
          >
            {action.label}
          </button>
        {/if}
        <button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Fermer" onclick={() => toasts.dismiss(toast.id)}>
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: var(--space5);
    bottom: var(--space5);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: var(--space4);
    width: 360px;
  }

  .toast {
    position: relative;
    padding: var(--space3) var(--space4) var(--space2);
    border: var(--outline);
    border-radius: var(--radiusLarge);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    transform: rotate(-1.5deg);
    animation: pop-in 0.35s var(--easeSpring);
  }

  .toast::after {
    content: '';
    position: absolute;
    bottom: -11px;
    left: 34px;
    width: 18px;
    height: 18px;
    border-right: var(--outline);
    border-bottom: var(--outline);
    background: inherit;
    transform: rotate(45deg);
  }

  /* <-- Une bonne nouvelle s'affiche sur des lignes de vitesse façon manga --> */
  .toast.is-success {
    background: repeating-conic-gradient(from 0deg at 50% 120%, var(--colorBlond) 0deg 5deg, var(--colorPaper) 5deg 10deg);
  }

  .toast.is-success::after {
    background: var(--colorPaper);
  }

  .toast.is-error {
    border-color: var(--colorDanger);
    box-shadow: 3px 3px 0 var(--colorDanger);
  }

  .toast.is-error::after {
    border-color: var(--colorDanger);
  }

  .message {
    font-family: var(--fontHand);
    font-size: 1.9rem;
    font-weight: 400;
    line-height: 1.2;
  }

  .is-success .message {
    display: inline;
    padding: 0 4px;
    background: var(--colorPaper);
    box-decoration-break: clone;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: var(--space2);
    margin-top: var(--space2);
  }

  small {
    flex: 1;
    color: var(--colorPlum);
    font-family: var(--fontHand);
    font-size: 1.5rem;
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: rotate(-1.5deg) scale(0.7);
    }
  }
</style>
