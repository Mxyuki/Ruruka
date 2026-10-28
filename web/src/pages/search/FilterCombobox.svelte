<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { TagGroup } from '../../api/queries/search';
  import { normalizeForMatch } from '../../lib/titleMatch';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    label: string;
    /** Options by category; a group with an empty category is shown without a heading. */
    loadGroups: () => Promise<TagGroup[]>;
    /** Names already picked, shown as checked; picking one again removes it. */
    picked: string[];
    onpick: (name: string) => void;
    /** Shown next to the label, such as a settings button. */
    labelAction?: Snippet;
  }

  let { label, loadGroups, picked, onpick, labelAction }: Props = $props();

  let groups = $state<TagGroup[]>([]);
  onMount(() => {
    loadGroups()
      .then((loaded) => (groups = loaded))
      .catch((error) => toasts.error(error, `Impossible de charger les ${label.toLowerCase()}`));
  });

  const listId = $props.id();
  let query = $state('');
  let isOpen = $state(false);
  let highlighted = $state(0);
  let list = $state<HTMLElement>();

  // <-- La saisie filtre sans tenir compte des accents ni de la casse -->
  const visibleGroups = $derived.by(() => {
    const needle = normalizeForMatch(query);
    if (!needle) return groups;
    return groups
      .map((group) => ({ ...group, names: group.names.filter((name) => normalizeForMatch(name).includes(needle)) }))
      .filter((group) => group.names.length);
  });
  const choices = $derived(visibleGroups.flatMap((group) => group.names));

  function open() {
    query = '';
    highlighted = 0;
    isOpen = true;
  }

  // <-- La liste reste ouverte pour enchaîner plusieurs choix -->
  function choose(name: string | undefined) {
    if (!name) return;
    onpick(name);
    query = '';
  }

  function moveHighlight(step: number) {
    if (!isOpen) return open();
    if (!choices.length) return;
    highlighted = (highlighted + step + choices.length) % choices.length;
    list?.querySelector(`[data-index="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      choose(choices[highlighted]);
    } else if (event.key === 'Escape') {
      isOpen = false;
    }
  }

  function oninput(event: Event & { currentTarget: HTMLInputElement }) {
    query = event.currentTarget.value;
    highlighted = 0;
    isOpen = true;
  }
</script>

{#snippet option(name: string, index: number)}
  <li
    role="option"
    data-index={index}
    aria-selected={picked.includes(name)}
    class:is-highlighted={highlighted === index}
    onmousedown={(event) => {
      event.preventDefault();
      choose(name);
    }}
    onmouseenter={() => (highlighted = index)}
  >
    {name}
  </li>
{/snippet}

<div class="combobox">
  <div class="label-row">
    <label class="field-label" for="{listId}-input">{label}</label>
    {@render labelAction?.()}
  </div>
  <input
    id="{listId}-input"
    class="input"
    type="text"
    role="combobox"
    autocomplete="off"
    aria-expanded={isOpen}
    aria-controls={listId}
    placeholder={isOpen ? 'Chercher…' : picked.length ? `${picked.length} choisi${picked.length > 1 ? 's' : ''}` : 'Tous'}
    value={query}
    onfocus={open}
    onclick={() => !isOpen && open()}
    onblur={() => (isOpen = false)}
    {oninput}
    {onkeydown}
  />
  {#if isOpen}
    <ul class="choices" id={listId} role="listbox" bind:this={list}>
      {#each visibleGroups as group (group.category)}
        {#if group.category}<li class="category" role="presentation">{group.category}</li>{/if}
        {#each group.names as name (name)}
          {@render option(name, choices.indexOf(name))}
        {/each}
      {/each}
      {#if !choices.length}<li class="none" role="presentation">Aucun résultat</li>{/if}
    </ul>
  {/if}
</div>

<style>
  .combobox {
    position: relative;
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space2);
  }

  /* <-- Liste posée sous le champ comme une fiche du carnet --> */
  .choices {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    left: 0;
    z-index: 20;
    max-height: 320px;
    margin: 0;
    padding: var(--space1);
    overflow-y: auto;
    border: var(--outline);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    list-style: none;
  }

  li {
    padding: 4px var(--space2);
    border-radius: var(--radiusSmall);
    font-size: var(--fontSizeSm);
    cursor: pointer;
  }

  li[aria-selected='true'] {
    background: var(--colorBlond);
  }

  li[aria-selected='true']::before {
    content: '✓ ';
  }

  li.is-highlighted {
    background: var(--colorMauveSoft);
  }

  .category {
    margin-top: var(--space2);
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
    font-weight: 800;
    text-transform: uppercase;
    cursor: default;
  }

  .none {
    color: var(--textFaint);
    cursor: default;
  }
</style>
