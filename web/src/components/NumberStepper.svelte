<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    value: number;
    max?: number | null;
    step?: number;
    label: string;
    onchange: (value: number) => void;
  }

  let { value, max = null, step = 1, label, onchange }: Props = $props();
  const decimals = $derived(step < 1 ? 1 : 0);

  function set(requested: number) {
    const rounded = Math.round(requested / step) * step;
    const clamped = Math.min(Math.max(rounded, 0), max ?? Infinity);
    const next = Number(clamped.toFixed(decimals));
    if (next !== value) onchange(next);
  }
</script>

<div class="stepper">
  <button class="btn btn-ghost btn-sm" type="button" aria-label="Diminuer : {label}" disabled={value <= 0} onclick={() => set(value - step)}>
    <Icon name="minus" size={14} />
  </button>
  <input
    class="input"
    type="number"
    min="0"
    max={max ?? undefined}
    {step}
    aria-label={label}
    value={value.toFixed(decimals)}
    onchange={(event) => set(Number(event.currentTarget.value) || 0)}
  />
  {#if max}<span class="max">/ {max}</span>{/if}
  <button class="btn btn-ghost btn-sm" type="button" aria-label="Augmenter : {label}" disabled={max !== null && value >= max} onclick={() => set(value + step)}>
    <Icon name="plus" size={14} />
  </button>
</div>

<style>
  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space1);
  }

  input {
    width: 72px;
    text-align: center;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }

  .max {
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
    white-space: nowrap;
  }
</style>
