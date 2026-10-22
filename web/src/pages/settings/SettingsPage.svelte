<script lang="ts">
  import AccountConnect from '../../components/AccountConnect.svelte';
  import ArtSlot from '../../components/ArtSlot.svelte';
  import LibraryRootPicker from '../../components/LibraryRootPicker.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import PlayerSetup from '../../components/PlayerSetup.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  const scaleOptions: [number, string][] = [
    [0, 'Automatique'],
    [0.9, 'Compacte'],
    [1, '100%'],
    [1.15, '115%'],
    [1.3, '130%'],
    [1.5, '150%'],
  ];

  async function update(patch: Parameters<typeof session.updateSettings>[0]) {
    try {
      await session.updateSettings(patch);
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer les réglages');
    }
  }
</script>

<div class="page settings">
  <div class="cards">
    <PageHeader title="Réglages" note="Ton carnet, à ta façon" />

    <section class="card">
      <Sticker name="etoile" size={60} rotate={-10} position="top: -24px; right: -20px" />
      <h2 class="note-label">Compte AniList</h2>
      <AccountConnect />
    </section>

    <section class="card" style:--accent="var(--colorStar)">
      <h2 class="note-label">Taille de l’interface</h2>
      <p class="hint">En automatique, la taille suit ta fenêtre : 100 % sur un écran 1080p, plus grand en 1440p et en 4K.</p>
      <div class="themes">
        {#each scaleOptions as [value, label] (value)}
          <button class="chip" class:is-active={session.settings?.interfaceScale === value} type="button" onclick={() => update({ interfaceScale: value })}>
            {label}
          </button>
        {/each}
      </div>
    </section>

    <section class="card" style:--accent="var(--colorSky)">
      <h2 class="note-label">Lecteur vidéo</h2>
      <PlayerSetup />
      <div class="option">
        <Toggle
          checked={session.settings?.hasSkipWarning ?? true}
          label="Me prévenir si je lance un épisode plus loin que ma progression"
          onchange={(hasSkipWarning) => update({ hasSkipWarning })}
        />
      </div>
      <div class="option">
        <Toggle
          checked={session.settings?.isCloseToTray ?? true}
          label="La croix range Ruruka dans la zone de notification (le suivi des épisodes continue)"
          onchange={(isCloseToTray) => update({ isCloseToTray })}
        />
      </div>
    </section>

    <section class="card" style:--accent="var(--colorLilac)">
      <h2 class="note-label">Dossier d’anime</h2>
      <LibraryRootPicker />
    </section>
  </div>

  <!-- Ruruka et sa glace tiennent compagnie pendant les réglages -->
  <aside class="companion">
    <ArtSlot name="configuration.png" width={200} height={537} />
  </aside>
</div>

<style>
  .settings {
    display: grid;
    grid-template-columns: minmax(0, 780px) auto;
    align-items: start;
    gap: var(--space7);
  }

  .companion {
    position: sticky;
    top: var(--space6);
    padding-top: var(--space7);
  }

  @media (max-width: 1280px) {
    .settings {
      grid-template-columns: minmax(0, 780px);
    }

    .companion {
      display: none;
    }
  }

  section {
    position: relative;
    margin-bottom: var(--space4);
    padding: var(--space5);
  }

  .themes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .themes .chip {
    border: 0;
    background: var(--colorSunken);
    cursor: pointer;
  }

  .themes .chip.is-active {
    background: var(--colorBlond);
  }

  .hint {
    margin: calc(var(--space2) * -1) 0 var(--space3);
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  .option {
    margin-top: var(--space4);
  }
</style>
