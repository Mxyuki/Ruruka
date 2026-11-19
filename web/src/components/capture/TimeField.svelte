<script lang="ts">
  import { formatPreciseClock, parseClock } from '../../lib/clock';

  interface Props {
    value: number;
    label: string;
    onchange: (seconds: number) => void;
  }

  let { value, label, onchange }: Props = $props();

  // <-- Pendant la frappe, le texte est celui de la personne ; il redevient l'heure exacte une fois validé -->
  let draft = $state<string | null>(null);

  const shown = $derived(draft ?? formatPreciseClock(value));

  function commit() {
    if (draft === null) return;
    const seconds = parseClock(draft);
    draft = null;
    if (seconds !== null) onchange(seconds);
  }

  function handleKey(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      draft = null;
      event.currentTarget.blur();
    }
  }
</script>

<input
  class="input time"
  type="text"
  inputmode="decimal"
  spellcheck="false"
  autocomplete="off"
  aria-label={label}
  title="Tape un temps : 75, 1:15 ou 1:15.5"
  value={shown}
  oninput={(event) => (draft = event.currentTarget.value)}
  onblur={commit}
  onkeydown={handleKey}
/>

<style>
  .time {
    width: 92px;
    padding: var(--space1) var(--space2);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
    text-align: center;
  }
</style>
