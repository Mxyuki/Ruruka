<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke, type PlayerStatus } from '../lib/bridge';
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import Icon from './Icon.svelte';

  let status = $state<PlayerStatus | null>(null);
  let isChecking = $state(false);

  onMount(detect);

  async function detect() {
    isChecking = true;
    try {
      status = await invoke('player.detect');
      await session.reloadSettings();
    } catch (error) {
      toasts.error(error, 'Impossible de chercher mpv');
    } finally {
      isChecking = false;
    }
  }

  async function choose() {
    const path = await invoke('shell.pickFile', { title: 'Trouver mpv.exe', filter: 'mpv|mpv.exe' });
    if (!path) return;
    try {
      await invoke('player.setPath', { path });
      await detect();
    } catch (error) {
      toasts.error(error);
    }
  }
</script>

{#if status?.isInstalled}
  <div class="status is-ok">
    <Icon name="check" />
    <div>
      <strong>mpv est prêt !</strong>
      <span class="path">{status.mpvPath}</span>
    </div>
    <button class="btn btn-ghost btn-sm" type="button" onclick={choose}>Changer</button>
  </div>
{:else if status}
  <div class="status is-missing">
    <Icon name="download" />
    <div>
      <strong>mpv n’est pas installé</strong>
      <p>
        Ruruka lance les épisodes dans <a href="https://mpv.io/installation/" target="_blank" rel="noopener noreferrer">mpv</a>,
        un lecteur vidéo léger. mpv sait exactement combien de l'épisode tu as regardé, donc Ruruka met ta liste à jour
        toute seule. Installe-le puis vérifie à nouveau. Tout le reste de Ruruka marche sans lui.
      </p>
    </div>
  </div>
  <div class="actions">
    <a class="btn btn-primary" href="https://mpv.io/installation/" target="_blank" rel="noopener noreferrer">
      <Icon name="external" size={14} /> Télécharger mpv
    </a>
    <button class="btn" type="button" disabled={isChecking} onclick={detect}>
      <Icon name="refresh" size={14} /> Vérifier à nouveau
    </button>
    <button class="btn btn-ghost" type="button" onclick={choose}>Trouver mpv.exe…</button>
  </div>
{/if}

<style>
  .status {
    display: flex;
    align-items: flex-start;
    gap: var(--space3);
    padding: var(--space4);
    border-radius: var(--radiusSmall);
    background: var(--colorSunken);
  }

  .status div {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space1);
    min-width: 0;
  }

  .is-ok {
    color: var(--colorSuccess);
  }

  .is-missing {
    color: var(--colorWarning);
  }

  strong {
    color: var(--textMain);
  }

  .path,
  p {
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
    word-break: break-all;
  }

  p {
    word-break: normal;
  }

  p a {
    color: var(--textSoft);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    margin-top: var(--space3);
  }
</style>
