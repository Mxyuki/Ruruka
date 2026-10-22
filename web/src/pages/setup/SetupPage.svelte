<script lang="ts">
  import AccountConnect from '../../components/AccountConnect.svelte';
  import ArtSlot from '../../components/ArtSlot.svelte';
  import Kira from '../../components/Kira.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import LibraryRootPicker from '../../components/LibraryRootPicker.svelte';
  import PlayerSetup from '../../components/PlayerSetup.svelte';
  import { session } from '../../state/session.svelte';

  const steps = [
    { id: 'account', label: 'Compte' },
    { id: 'player', label: 'Lecteur' },
    { id: 'library', label: 'Dossier' },
  ] as const;

  let stepIndex = $state(0);
  const step = $derived(steps[stepIndex]?.id ?? 'account');
  const isLastStep = $derived(stepIndex === steps.length - 1);
  const canContinue = $derived(step !== 'account' || Boolean(session.viewer));

  function next() {
    if (!isLastStep) stepIndex++;
    else void session.updateSettings({ isSetupComplete: true });
  }
</script>

<div class="setup">
  <aside>
    <ArtSlot name="configuration.png" width={208} height={560} />
    <h1>Ruruka<Kira size={30} /></h1>
    <p>Ton carnet d'enquête AniList</p>
  </aside>

  <!-- Le carnet, avec un onglet par étape -->
  <section class="notebook-page">
    <i class="tape is-star"></i>
    <Sticker name="lune" size={70} rotate={14} position="top: -30px; right: -26px" />
    <ol class="tabs">
      {#each steps as item, index (item.id)}
        <li class:is-current={index === stepIndex} class:is-done={index < stepIndex}>
          <span>{['I', 'II', 'III'][index]}</span>{item.label}
        </li>
      {/each}
    </ol>

    {#if step === 'account'}
      <h2>Connecte ton compte AniList</h2>
      <p class="lead">Ruruka lit et met à jour tes listes grâce à l'API officielle d'AniList.</p>
      <AccountConnect />
    {:else if step === 'player'}
      <h2>Le lecteur vidéo</h2>
      <p class="lead">Les épisodes s'ouvrent dans mpv. Ta liste se met à jour quand tu as vu 80 % d'un épisode.</p>
      <PlayerSetup />
    {:else}
      <h2>Ton dossier d'anime</h2>
      <p class="lead">Facultatif : indique où sont tes téléchargements pour lancer les épisodes depuis chaque fiche.</p>
      <LibraryRootPicker />
    {/if}

    <footer>
      {#if stepIndex > 0}
        <button class="btn btn-ghost" type="button" onclick={() => stepIndex--}>Retour</button>
      {/if}
      <span class="spacer"></span>
      {#if step !== 'account'}
        <button class="btn btn-ghost" type="button" onclick={next}>Passer</button>
      {/if}
      <button class="btn btn-primary" type="button" disabled={!canContinue} onclick={next}>
        {isLastStep ? 'Commencer l’enquête !' : 'Continuer'}
      </button>
    </footer>
  </section>
</div>

<style>
  .setup {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) minmax(0, 640px);
    align-items: center;
    gap: var(--space7);
    max-width: 1120px;
    min-height: 100%;
    margin: 0 auto;
    padding: var(--space6);
  }

  aside {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space2);
    text-align: center;
  }

  h1 {
    display: inline-flex;
    align-items: flex-start;
    gap: 4px;
    font-size: 5rem;
  }

  aside p {
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 2.2rem;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--space4);
    padding: var(--space6) var(--space6) var(--space5) 56px;
    transform: rotate(0.5deg);
  }

  section .tape {
    top: -10px;
    left: 45%;
  }

  .tabs {
    display: flex;
    gap: var(--space2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tabs li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px 4px 4px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    color: var(--textFaint);
    font-weight: 800;
  }

  .tabs span {
    display: grid;
    min-width: 26px;
    height: 26px;
    place-items: center;
    border: var(--outlineThin);
    border-radius: 50%;
    background: var(--colorSunken);
    font-family: var(--fontTitle);
    font-size: 1.1rem;
  }

  .tabs .is-done {
    color: var(--textSoft);
  }

  .tabs .is-done span {
    background: var(--colorMauve);
  }

  .tabs .is-current {
    border-width: 2px;
    background: var(--colorStar);
    box-shadow: 2px 2px 0 var(--colorInk);
    color: var(--textMain);
  }

  .tabs .is-current span {
    background: var(--colorPaper);
  }

  h2 {
    font-size: var(--fontSizeXl);
  }

  .lead {
    margin-top: calc(var(--space2) * -1);
    color: var(--textSoft);
  }

  footer {
    display: flex;
    gap: var(--space2);
    margin-top: var(--space3);
  }

  .spacer {
    flex: 1;
  }
</style>
