<script lang="ts">
  import PlayerSetup from '../../components/PlayerSetup.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import PlayerWindowCard from './PlayerWindowCard.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  const completionOptions = [70, 75, 80, 85, 90, 95];
  const minimumWatchedOptions = [30, 40, 50, 60, 70];
</script>

<section class="card settings-card" style:--accent="var(--colorSky)">
  <h2 class="note-label">Lecteur vidéo</h2>
  <PlayerSetup />
  <div class="settings-option">
    <Toggle
      checked={session.settings?.hasSkipWarning ?? true}
      label="Me prévenir si je lance un épisode plus loin que ma progression"
      onchange={(hasSkipWarning) => update({ hasSkipWarning })}
    />
  </div>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.isPlayerKeptOpen ?? true}
      label="Garder le lecteur ouvert à la fin d’un épisode : le suivant se lance dans la même fenêtre (pratique en partage d’écran sur Discord)"
      onchange={(isPlayerKeptOpen) => update({ isPlayerKeptOpen })}
    />
  </div>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.isDiscordPresenceShown ?? true}
      label="Montrer sur Discord ce que je regarde avec le lecteur Ruruka, et inviter ou être invité à une séance depuis Discord"
      onchange={(isDiscordPresenceShown) => update({ isDiscordPresenceShown })}
    />
  </div>
</section>

<!-- Les aides à l'enchaînement, dessinées par le lecteur Ruruka -->
<section class="card settings-card" style:--accent="var(--colorMauve)">
  <h2 class="note-label">Enchaîner les épisodes</h2>
  <p class="settings-hint">Pour le lecteur livré avec Ruruka. Ces choix valent à partir du prochain épisode lancé.</p>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.isNextEpisodePromptShown ?? true}
      label="Dans les dernières secondes d’un épisode, proposer le suivant en un clic s’il est dans mon dossier (pas pendant un enchaînement, seulement après le dernier)"
      onchange={(isNextEpisodePromptShown) => update({ isNextEpisodePromptShown })}
    />
  </div>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.areEpisodeArrowsShown ?? true}
      label="Flèches « épisode précédent » et « épisode suivant » dans la barre du lecteur, quand ces épisodes sont dans mon dossier (touches &lt; et &gt;)"
      onchange={(areEpisodeArrowsShown) => update({ areEpisodeArrowsShown })}
    />
  </div>
</section>

<PlayerWindowCard {update} />

<!-- Quand un épisode compte comme vu -->
<section class="card settings-card" style:--accent="var(--colorStrawberry)">
  <h2 class="note-label">Épisode vu</h2>

  <h3 class="settings-subtitle">Épisode vu à</h3>
  <p class="settings-hint">L’épisode est coché sur AniList une fois la lecture arrivée à ce point.</p>
  <div class="settings-choices">
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

  <h3 class="settings-subtitle">Temps vu minimum</h3>
  <p class="settings-hint">Tu peux passer les génériques et les passages lents tant que tu as vraiment regardé cette part de l’épisode. Revoir une scène ne compte qu’une fois.</p>
  <div class="settings-choices">
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
