<script lang="ts">
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import Toggle from '../../components/Toggle.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();
</script>

<!-- Options propres au lecteur Ruruka -->
<h3 class="option-title">Lecteur Ruruka</h3>
<p class="hint">Ces options valent pour le lecteur livré avec Ruruka, à la prochaine fenêtre ouverte.</p>
<div class="option">
  <Toggle
    checked={session.settings?.isCaptureEnabled ?? true}
    label="Bouton de capture (ou touche C) : fige l’image et ouvre l’atelier pour la copier ou l’enregistrer"
    onchange={(isCaptureEnabled) => update({ isCaptureEnabled })}
  />
</div>
<div class="option">
  <Toggle
    checked={session.settings?.isClipEnabled ?? true}
    label="Clips : découper un extrait de l’épisode en MP4 ou WebM depuis l’atelier de capture"
    onchange={(isClipEnabled) => update({ isClipEnabled })}
  />
</div>

<style>
  .option-title {
    margin: var(--space5) 0 var(--space3);
    font-size: var(--fontSizeSm);
    font-weight: 800;
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
