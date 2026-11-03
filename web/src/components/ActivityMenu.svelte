<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    /** Only statuses can be edited; AniList writes list activities itself. */
    canEdit: boolean;
    onedit: () => void;
    /** Resolves true once deleted; false keeps the menu open on the confirmation. */
    ondelete: () => Promise<boolean>;
  }

  let { canEdit, onedit, ondelete }: Props = $props();

  const menuId = $props.id();
  let trigger = $state<HTMLButtonElement>();
  let menu = $state<HTMLElement>();
  let isConfirming = $state(false);
  let isDeleting = $state(false);

  // <-- Le menu s'ouvre dans la couche du dessus, calé sous les trois points -->
  function place(event: ToggleEvent) {
    if (event.newState !== 'open' || !trigger || !menu) {
      isConfirming = false;
      return;
    }
    const anchor = trigger.getBoundingClientRect();
    menu.style.top = `${anchor.bottom + 4}px`;
    menu.style.left = `${anchor.right}px`;
  }

  function edit() {
    menu?.hidePopover();
    onedit();
  }

  async function confirmDelete() {
    isDeleting = true;
    const isDeleted = await ondelete();
    isDeleting = false;
    if (isDeleted) menu?.hidePopover();
  }
</script>

<button class="trigger" type="button" aria-label="Options de l’activité" popovertarget={menuId} bind:this={trigger}>
  <Icon name="more" size={18} />
</button>

<div class="menu" id={menuId} popover="auto" bind:this={menu} onbeforetoggle={place}>
  {#if isConfirming}
    <p>Effacer cette piste pour de bon ?</p>
    <button class="item danger" type="button" disabled={isDeleting} onclick={confirmDelete}>
      <Icon name="trash" size={14} /> {isDeleting ? 'Suppression…' : 'Oui, supprimer'}
    </button>
    <button class="item" type="button" onclick={() => (isConfirming = false)}>Annuler</button>
  {:else}
    {#if canEdit}
      <button class="item" type="button" onclick={edit}><Icon name="edit" size={14} /> Modifier</button>
    {/if}
    <button class="item danger" type="button" onclick={() => (isConfirming = true)}><Icon name="trash" size={14} /> Supprimer</button>
  {/if}
</div>

<style>
  .trigger {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--textFaint);
    cursor: pointer;
    transition: background var(--transitionFast), color var(--transitionFast);
  }

  .trigger:hover,
  .trigger:focus-visible {
    background: var(--colorMauveSoft);
    color: var(--textSoft);
  }

  /* <-- Fiche de carnet alignée sur le bord droit des trois points --> */
  .menu {
    position: fixed;
    inset: auto;
    min-width: 180px;
    margin: 0;
    padding: var(--space1);
    border: var(--outline);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    color: var(--textMain);
    transform: translateX(-100%);
  }

  p {
    max-width: 200px;
    padding: var(--space2);
    font-family: var(--fontHand);
    font-size: var(--fontSizeMd);
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space2);
    width: 100%;
    padding: 6px var(--space2);
    border: 0;
    border-radius: var(--radiusSmall);
    background: none;
    color: inherit;
    cursor: pointer;
    font-size: var(--fontSizeSm);
    font-weight: 700;
    text-align: left;
  }

  .item:hover {
    background: var(--colorMauveSoft);
  }

  .danger {
    color: var(--colorDanger);
  }
</style>
