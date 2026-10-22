<script lang="ts">
  import type { MediaSummary } from '../api/types';
  import { mediaList } from '../state/mediaList.svelte';
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    media: MediaSummary;
  }

  let { media }: Props = $props();

  const tapeColors = ['var(--colorStrawberry)', 'var(--colorSky)', 'var(--colorStar)', 'var(--colorLilac)', 'var(--colorMauve)'];
  const maxNameLength = 40;

  const names = $derived(session.customListNames(media.type));
  const entry = $derived(mediaList.entryFor(media.id));
  const enabled = $derived(new Set(entry?.customLists?.filter((list) => list.enabled).map((list) => list.name) ?? []));

  let isSaving = $state(false);
  let isCreating = $state(false);
  let newName = $state('');

  async function run(task: () => Promise<unknown>, context: string) {
    isSaving = true;
    try {
      await task();
    } catch (error) {
      toasts.error(error, context);
    } finally {
      isSaving = false;
    }
  }

  // <-- Cocher ou décocher une liste : AniList attend toutes les listes où l'entrée doit figurer -->
  function toggle(name: string) {
    const next = enabled.has(name) ? [...enabled].filter((list) => list !== name) : [...enabled, name];
    void run(() => mediaList.save(media, { customLists: next }), 'Impossible de modifier tes listes');
  }

  async function create() {
    const name = newName.trim().slice(0, maxNameLength);
    if (!name || names.includes(name)) return;
    await run(async () => {
      await session.addCustomList(media.type, name);
      await mediaList.save(media, { customLists: [...enabled, name] });
      toasts.success(`Ajouté à la liste « ${name} » !`);
    }, 'Impossible de créer la liste');
    newName = '';
    isCreating = false;
  }
</script>

<!-- Listes perso en morceaux de washi tape : cochés quand l'anime en fait partie -->
<div class="picker">
  {#each names as name, index (name)}
    {@const isOn = enabled.has(name)}
    <button
      class="tape-chip"
      class:is-on={isOn}
      style:--tape={tapeColors[index % tapeColors.length]}
      type="button"
      aria-pressed={isOn}
      disabled={isSaving}
      data-sparkle
      onclick={() => toggle(name)}
    >
      {#if isOn}<Icon name="check" size={13} />{/if}
      {name}
    </button>
  {/each}

  {#if isCreating}
    <form class="new" onsubmit={(event) => { event.preventDefault(); void create(); }}>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" maxlength={maxNameLength} placeholder="Nom de la liste" aria-label="Nom de la nouvelle liste" bind:value={newName} autofocus />
      <button class="btn btn-primary btn-sm" type="submit" disabled={!newName.trim() || isSaving}>Créer</button>
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => (isCreating = false)}>Annuler</button>
    </form>
  {:else}
    <button class="btn btn-ghost btn-sm" type="button" onclick={() => (isCreating = true)}>
      <Icon name="plus" size={13} /> Nouvelle liste
    </button>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .tape-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 14px;
    border: 0;
    background: color-mix(in srgb, var(--tape) 30%, transparent);
    clip-path: polygon(3% 0, 100% 6%, 97% 100%, 0 94%);
    color: var(--textSoft);
    cursor: pointer;
    font-weight: 800;
    transition: background var(--transitionFast), transform 0.2s var(--easeSpring);
  }

  .tape-chip:nth-child(odd) {
    transform: rotate(-2deg);
  }

  .tape-chip:hover:not(:disabled) {
    transform: rotate(2deg) scale(1.06);
  }

  .tape-chip.is-on {
    background: color-mix(in srgb, var(--tape) 85%, transparent);
    color: var(--textMain);
  }

  .new {
    display: flex;
    align-items: center;
    gap: var(--space2);
  }

  .new .input {
    width: 200px;
    padding: 4px 10px;
  }
</style>
