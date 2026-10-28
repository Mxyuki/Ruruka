<script lang="ts">
  import Icon from '../../components/Icon.svelte';
  import Modal from '../../components/Modal.svelte';
  import { mediaSections, orderSections, type MediaSectionId } from '../../lib/mediaSections';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  const typeNotes = { ANIME: 'anime', MANGA: 'manga' } as const;
  let order = $state<MediaSectionId[]>([]);
  let isSaving = $state(false);

  // <-- Chaque ouverture repart de l'ordre enregistré -->
  $effect(() => {
    if (open) order = orderSections(session.settings?.mediaSectionOrder ?? []);
  });

  const sectionOf = (id: MediaSectionId) => mediaSections.find((section) => section.id === id);

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target] as MediaSectionId, next[index] as MediaSectionId];
    order = next;
  }

  async function save(saved: MediaSectionId[]) {
    isSaving = true;
    try {
      await session.updateSettings({ mediaSectionOrder: saved });
      toasts.success('Ordre des sections enregistré !');
      onclose();
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer l’ordre des sections');
    } finally {
      isSaving = false;
    }
  }
</script>

<Modal {open} title="Ordre des sections" {onclose}>
  <p class="hint">L’ordre dans lequel les sections apparaissent sous l’en-tête d’un anime ou d’un manga.</p>
  <ol>
    {#each order as id, index (id)}
      {@const section = sectionOf(id)}
      <li>
        <span class="position">{index + 1}</span>
        <span class="label">
          {section?.label}
          {#if section?.onlyFor}<span class="faint">({typeNotes[section.onlyFor]} seulement)</span>{/if}
        </span>
        <button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Monter {section?.label}" disabled={index === 0} onclick={() => move(index, -1)}>
          <Icon name="chevronLeft" size={14} />
        </button>
        <button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Descendre {section?.label}" disabled={index === order.length - 1} onclick={() => move(index, 1)}>
          <Icon name="chevronRight" size={14} />
        </button>
      </li>
    {/each}
  </ol>

  {#snippet footer()}
    <button class="btn btn-ghost" type="button" disabled={isSaving} onclick={() => save([])}>
      <Icon name="refresh" size={14} /> Réinitialiser
    </button>
    <button class="btn" type="button" onclick={onclose}>Annuler</button>
    <button class="btn btn-primary" type="button" disabled={isSaving} onclick={() => save(order)}>Enregistrer</button>
  {/snippet}
</Modal>

<style>
  .hint {
    margin-bottom: var(--space3);
    color: var(--textFaint);
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space2);
    padding: var(--space2) var(--space3);
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
  }

  .position {
    min-width: 26px;
    color: var(--textFaint);
    font-family: var(--fontFile);
  }

  .label {
    flex: 1;
    font-weight: 800;
  }

  /* <-- Les chevrons gauche / droite tournés servent de flèches haut / bas --> */
  li .btn-icon :global(svg) {
    transform: rotate(90deg);
  }
</style>
