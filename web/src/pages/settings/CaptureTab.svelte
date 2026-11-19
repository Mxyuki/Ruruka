<script lang="ts">
  import Toggle from '../../components/Toggle.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import ClipEngineCard from './ClipEngineCard.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();
</script>

<!-- Les deux fonctions de l'atelier de capture, propres au lecteur Ruruka -->
<section class="card settings-card" style:--accent="var(--colorSky)">
  <h2 class="note-label">Atelier de capture</h2>
  <p class="settings-hint">Ces options valent pour le lecteur livré avec Ruruka, à la prochaine fenêtre ouverte.</p>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.isCaptureEnabled ?? true}
      label="Bouton de capture (ou touche C) : fige l’image et ouvre l’atelier pour la copier ou l’enregistrer"
      onchange={(isCaptureEnabled) => update({ isCaptureEnabled })}
    />
  </div>
  <div class="settings-option">
    <Toggle
      checked={session.settings?.isClipEnabled ?? true}
      label="Clips : découper un extrait de l’épisode en vidéo depuis l’atelier de capture"
      onchange={(isClipEnabled) => update({ isClipEnabled })}
    />
  </div>
</section>

<ClipEngineCard />
