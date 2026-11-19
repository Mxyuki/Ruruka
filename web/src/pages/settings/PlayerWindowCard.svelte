<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke, type PlayerScreenMode, type ScreenChoice, type SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  const modes: [PlayerScreenMode, string][] = [
    ['app', 'L’écran de Ruruka'],
    ['fixed', 'Toujours le même écran'],
    ['last', 'Là où je l’ai fermé'],
  ];

  let screens = $state<ScreenChoice[]>([]);

  const mode = $derived(session.settings?.playerScreenMode ?? 'app');
  const chosenName = $derived(session.settings?.playerScreenName ?? '');
  const hasSeveralScreens = $derived(screens.length > 1);

  async function detectScreens() {
    try {
      screens = await invoke('player.screens');
    } catch (error) {
      toasts.error(error, 'Impossible de détecter les écrans');
    }
  }

  onMount(detectScreens);

  // <-- Choisir « même écran » sans en avoir désigné un : on part de celui de Ruruka, que la personne peut changer aussitôt -->
  function chooseMode(next: PlayerScreenMode) {
    if (next !== 'fixed' || screens.some((screen) => screen.name === chosenName)) {
      void update({ playerScreenMode: next });
      return;
    }
    const start = screens.find((screen) => screen.isAppScreen) ?? screens[0];
    void update({ playerScreenMode: next, playerScreenName: start?.name ?? '' });
  }

  const describe = (screen: ScreenChoice) => `Écran ${screen.number} · ${screen.width}×${screen.height}${screen.isPrimary ? ' · principal' : ''}`;
</script>

<section class="card settings-card" style:--accent="var(--colorSky)">
  <h2 class="note-label">Fenêtre du lecteur</h2>
  <p class="settings-hint">
    Où s’ouvre le lecteur Ruruka quand il n’est pas déjà ouvert. Un épisode lancé dans une fenêtre déjà ouverte la garde là où elle est.
  </p>

  <div class="settings-choices">
    {#each modes as [value, label] (value)}
      <button class="chip" class:is-active={mode === value} type="button" onclick={() => chooseMode(value)}>{label}</button>
    {/each}
  </div>

  {#if mode === 'fixed'}
    <!-- Les écrans détectés sur ce PC -->
    <h3 class="settings-subtitle">Quel écran ?</h3>
    <div class="settings-choices">
      {#each screens as screen (screen.name)}
        <button class="chip" class:is-active={chosenName === screen.name} type="button" onclick={() => update({ playerScreenName: screen.name })}>
          {describe(screen)}{screen.isAppScreen ? ' · Ruruka est ici' : ''}
        </button>
      {/each}
    </div>
  {/if}

  <p class="detected faint">
    {#if hasSeveralScreens}
      {screens.length} écrans détectés.
    {:else}
      Un seul écran détecté : le lecteur s’ouvre toujours dessus.
    {/if}
    <button class="btn btn-ghost btn-sm" type="button" onclick={detectScreens}>Détecter à nouveau</button>
  </p>
  {#if mode === 'fixed' && hasSeveralScreens && !screens.some((screen) => screen.name === chosenName)}
    <p class="detected faint">L’écran choisi n’est plus branché : le lecteur s’ouvre sur celui de Ruruka.</p>
  {/if}
</section>

<style>
  .detected {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space3);
    margin: var(--space4) 0 0;
    font-size: var(--fontSizeSm);
  }
</style>
