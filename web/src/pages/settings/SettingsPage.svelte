<script lang="ts">
  import AccountConnect from '../../components/AccountConnect.svelte';
  import ArtSlot from '../../components/ArtSlot.svelte';
  import LibraryRootPicker from '../../components/LibraryRootPicker.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import PlayerSetup from '../../components/PlayerSetup.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import SectionOrderDialog from './SectionOrderDialog.svelte';
  import SitesCard from './SitesCard.svelte';
  import ThemeCard from './ThemeCard.svelte';

  const scaleOptions: [number, string][] = [
    [0, 'Automatique'],
    [0.9, 'Compacte'],
    [1, '100%'],
    [1.15, '115%'],
    [1.3, '130%'],
    [1.5, '150%'],
  ];

  const completionOptions = [70, 75, 80, 85, 90, 95];
  const minimumWatchedOptions = [30, 40, 50, 60, 70];
  let isSectionOrderOpen = $state(false);
  const hasCustomOrder = $derived(Boolean(session.settings?.mediaSectionOrder.length));

  async function update(patch: SettingsPatch) {
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

    <ThemeCard {update} />

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
      <div class="option">
        <Toggle
          checked={session.settings?.isLaunchedAtStartup ?? false}
          label="Lancer Ruruka au démarrage de Windows, discrètement dans la zone de notification"
          onchange={(isLaunchedAtStartup) => update({ isLaunchedAtStartup })}
        />
      </div>
      <div class="option">
        <Toggle
          checked={session.settings?.isPlayerKeptOpen ?? true}
          label="Garder mpv ouvert à la fin d’un épisode : le suivant se lance dans la même fenêtre (pratique en partage d’écran sur Discord)"
          onchange={(isPlayerKeptOpen) => update({ isPlayerKeptOpen })}
        />
      </div>

      <!-- Quand un épisode compte comme vu -->
      <h3 class="option-title">Épisode vu à</h3>
      <p class="hint">L’épisode est coché sur AniList une fois la lecture arrivée à ce point.</p>
      <div class="themes">
        {#each completionOptions as percent (percent)}
          <button
            class="chip"
            class:is-active={session.settings?.episodeCompletionPercent === percent}
            type="button"
            onclick={() => update({ episodeCompletionPercent: percent })}
          >
            {percent} %
          </button>
        {/each}
      </div>

      <h3 class="option-title">Temps vu minimum</h3>
      <p class="hint">Tu peux passer les génériques et les passages lents tant que tu as vraiment regardé cette part de l’épisode. Revoir une scène ne compte qu’une fois.</p>
      <div class="themes">
        {#each minimumWatchedOptions as percent (percent)}
          <button
            class="chip"
            class:is-active={session.settings?.minimumWatchedPercent === percent}
            type="button"
            onclick={() => update({ minimumWatchedPercent: percent })}
          >
            {percent} %
          </button>
        {/each}
      </div>
    </section>

    <section class="card" style:--accent="var(--colorStrawberry)">
      <h2 class="note-label">Page d’un anime ou d’un manga</h2>
      <p class="hint">Choisis dans quel ordre s’affichent le résumé, les épisodes, le fil des indices, la bande-son…</p>
      <button class="btn" type="button" onclick={() => (isSectionOrderOpen = true)}>Configurer l’ordre des sections</button>
      {#if hasCustomOrder}<span class="faint custom-order">Ordre personnalisé</span>{/if}
    </section>

    <SitesCard {update} />

    <section class="card" style:--accent="var(--colorLilac)">
      <h2 class="note-label">Dossier d’anime</h2>
      <LibraryRootPicker />
    </section>
  </div>

  <!-- Ruruka et sa glace tiennent compagnie pendant les réglages -->
  <SectionOrderDialog open={isSectionOrderOpen} onclose={() => (isSectionOrderOpen = false)} />

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

  .custom-order {
    margin-left: var(--space3);
    font-family: var(--fontHand);
    font-size: var(--fontSizeMd);
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

  .option-title {
    margin: var(--space5) 0 var(--space3);
    font-size: var(--fontSizeSm);
    font-weight: 800;
  }
</style>
