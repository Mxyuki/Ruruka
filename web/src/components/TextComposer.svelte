<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    placeholder: string;
    submitLabel: string;
    /** Rejecting keeps the draft so nothing typed is lost. */
    onsubmit: (text: string) => Promise<void>;
    avatar?: string;
  }

  let { placeholder, submitLabel, onsubmit, avatar }: Props = $props();

  let text = $state('');
  let isSending = $state(false);
  const canSend = $derived(text.trim().length > 0 && !isSending);

  async function send() {
    if (!canSend) return;
    isSending = true;
    try {
      await onsubmit(text.trim());
      text = '';
    } finally {
      isSending = false;
    }
  }

  // <-- Entrée envoie, Maj+Entrée ajoute une ligne -->
  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void send();
  }
</script>

<div class="composer">
  {#if avatar}<img src={avatar} alt="" width="30" height="30" />{/if}
  <textarea class="input" rows="1" {placeholder} aria-label={placeholder} bind:value={text} {onkeydown}></textarea>
  <button class="btn btn-primary btn-sm" type="button" disabled={!canSend} onclick={send}>
    <Icon name="chevronRight" size={14} />
    {submitLabel}
  </button>
</div>

<style>
  .composer {
    display: flex;
    align-items: flex-end;
    gap: var(--space2);
  }

  img {
    flex-shrink: 0;
    border-radius: 50%;
    object-fit: cover;
  }

  textarea {
    min-height: 38px;
    max-height: 160px;
    resize: none;
    field-sizing: content;
  }
</style>
