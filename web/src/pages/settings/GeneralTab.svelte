<script lang="ts">
  import AccountConnect from '../../components/AccountConnect.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import ThemeCard from './ThemeCard.svelte';
  import UpdateCard from './UpdateCard.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  const scaleOptions: [number, string][] = [
    [0, 'Automatique'],
    [0.9, 'Compacte'],
    [1, '100%'],
    [1.15, '115%'],
    [1.3, '130%'],
    [1.5, '150%'],
  ];
</script>

<section class="card settings-card">
  <Sticker name="etoile" size={60} rotate={-10} position="top: -24px; right: -20px" />
  <h2 class="note-label">Compte AniList</h2>
  <AccountConnect />
</section>

<ThemeCard {update} />

<section class="card settings-card" style:--accent="var(--colorStar)">
  <h2 class="note-label">Taille de l’interface</h2>
  <p class="settings-hint">En automatique, la taille suit ta fenêtre : 100 % sur un écran 1080p, plus grand en 1440p et en 4K.</p>
  <div class="settings-choices">
    {#each scaleOptions as [value, label] (value)}
      <button class="chip" class:is-active={session.settings?.interfaceScale === value} type="button" onclick={() => update({ interfaceScale: value })}>
        {label}
      </button>
    {/each}
  </div>
</section>

<!-- Fenêtre et démarrage -->
<section class="card settings-card" style:--accent="var(--colorMauve)">
  <h2 class="note-label">Fenêtre et démarrage</h2>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.isCloseToTray ?? true}
      label="La croix range Ruruka dans la zone de notification (le suivi des épisodes continue)"
      onchange={(isCloseToTray) => update({ isCloseToTray })}
    />
  </div>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.isLaunchedAtStartup ?? false}
      label="Lancer Ruruka au démarrage de Windows, discrètement dans la zone de notification"
      onchange={(isLaunchedAtStartup) => update({ isLaunchedAtStartup })}
    />
  </div>
</section>

<UpdateCard />
