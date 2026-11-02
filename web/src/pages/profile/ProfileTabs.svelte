<script lang="ts">
  import { router } from '../../lib/router.svelte';
  import { userPath, userSectionPath } from '../../lib/routes';

  interface Props {
    name: string;
    avatar: string;
  }

  let { name, avatar }: Props = $props();

  const tabs = $derived([
    { label: 'Profil', path: userPath(name) },
    { label: 'Social', path: userSectionPath(name, 'social') },
    { label: 'Stats', path: userSectionPath(name, 'stats') },
    { label: 'Critiques', path: userSectionPath(name, 'reviews') },
  ]);
</script>

<!-- Onglets du dossier d'un détective -->
<nav>
  <a class="identity" href="#{userPath(name)}">
    <img src={avatar} alt="" width="44" height="44" />
    <strong>{name}</strong>
  </a>
  <div class="tabs">
    {#each tabs as tab (tab.path)}
      {@const active = router.path.split('?')[0] === tab.path}
      <a class="chip" class:is-active={active} href="#{tab.path}" aria-current={active ? 'page' : undefined}>{tab.label}</a>
    {/each}
  </div>
</nav>

<style>
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space4);
    margin-bottom: var(--space5);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: var(--space3);
    font-size: var(--fontSizeLg);
  }

  img {
    border: var(--outline);
    border-radius: var(--radiusSticker);
    object-fit: cover;
    transform: rotate(-4deg);
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }
</style>
