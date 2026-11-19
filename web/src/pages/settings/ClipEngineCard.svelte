<script lang="ts">
  import type { ClipEngine } from '../../lib/bridge';
  import { ffmpeg } from '../../state/ffmpeg.svelte';
  import { session } from '../../state/session.svelte';

  const engine = $derived<ClipEngine>(session.settings?.clipEngine ?? 'mpv');

  function choose(next: ClipEngine) {
    if (next === engine) return;
    if (next === 'ffmpeg') void ffmpeg.enable();
    else void ffmpeg.disable();
  }
</script>

<section class="card settings-card" style:--accent="var(--colorLilac)">
  <h2 class="note-label">Moteur des clips</h2>
  <p class="settings-hint">Comment l’atelier encode un clip. Tu peux changer à tout moment : ça ne touche pas aux clips déjà faits.</p>

  <div class="settings-choices">
    <button class="chip" class:is-active={engine === 'mpv'} type="button" disabled={ffmpeg.isInstalling} onclick={() => choose('mpv')}>mpv (par défaut)</button>
    <button class="chip" class:is-active={engine === 'ffmpeg'} type="button" disabled={ffmpeg.isInstalling} onclick={() => choose('ffmpeg')}>ffmpeg (réglages avancés)</button>
  </div>

  <ul class="explain">
    <li><strong>mpv</strong> : rien à télécharger. « Qualité max » ou « Léger pour Discord », en MP4 ou en WebM.</li>
    <li>
      <strong>ffmpeg</strong> : tes propres commandes (x265, AV1, débit, filtres…), enregistrées sous un nom dans l’atelier, avec « Qualité max » et « Léger pour Discord » comme
      point de départ. Ruruka télécharge ffmpeg une seule fois (environ 40 Mo) et le garde dans ton dossier de données.
    </li>
  </ul>

  {#if ffmpeg.isInstalling}
    <!-- Téléchargement en cours -->
    <div class="download">
      <progress max="1" value={ffmpeg.ratio}></progress>
      <span class="faint">{Math.round(ffmpeg.ratio * 100)} %</span>
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => ffmpeg.cancel()}>Annuler</button>
    </div>
  {:else if ffmpeg.isInstalled}
    <div class="download">
      <span class="faint">ffmpeg est installé sur ce PC.</span>
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => ffmpeg.remove()}>Supprimer ffmpeg</button>
    </div>
  {/if}
</section>

<style>
  .explain {
    margin: var(--space4) 0 0;
    padding-left: var(--space5);
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
  }

  .explain li + li {
    margin-top: var(--space2);
  }

  .download {
    display: flex;
    align-items: center;
    gap: var(--space3);
    margin-top: var(--space4);
  }

  progress {
    flex: 1;
    accent-color: var(--colorStar);
  }

  .chip:disabled {
    cursor: wait;
    opacity: 0.6;
  }
</style>
