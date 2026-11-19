import { invoke, on } from '../lib/bridge';
import { session } from './session.svelte';
import { toasts } from './toasts.svelte';

/** The optional ffmpeg of the clip workshop: downloaded on request, and switched on or off as the clip engine. */
class Ffmpeg {
  isInstalled = $state(false);
  isInstalling = $state(false);
  /** How far the download is, 0 to 1. */
  ratio = $state(0);

  init(): void {
    on('ffmpeg.progress', ({ ratio }) => {
      this.ratio = ratio;
    });
    void this.refresh().then(() => this.installIfAsked());
  }

  async refresh(): Promise<void> {
    try {
      const status = await invoke('ffmpeg.status');
      this.isInstalled = status.isInstalled;
      this.isInstalling = status.isInstalling;
    } catch (error) {
      toasts.error(error, 'Impossible de vérifier ffmpeg');
    }
  }

  /** Turns the ffmpeg engine on, downloading ffmpeg first when this PC doesn't have it yet. */
  async enable(): Promise<void> {
    if (this.isInstalling) return;
    try {
      if (!this.isInstalled) await this.download();
      await session.updateSettings({ clipEngine: 'ffmpeg' });
      toasts.success('ffmpeg est prêt : les clips utilisent tes réglages avancés.');
    } catch (error) {
      toasts.error(error, 'Impossible d’activer ffmpeg');
    }
  }

  /** Back to the player's own encoder; ffmpeg stays on disk for later. */
  async disable(): Promise<void> {
    try {
      await session.updateSettings({ clipEngine: 'mpv' });
    } catch (error) {
      toasts.error(error, 'Impossible de revenir à mpv');
    }
  }

  cancel(): void {
    invoke('ffmpeg.cancelInstall').catch((error) => toasts.error(error, 'Impossible d’arrêter le téléchargement'));
  }

  /** Deletes the downloaded ffmpeg; clips go back to mpv first, since the engine needs the file. */
  async remove(): Promise<void> {
    try {
      await session.updateSettings({ clipEngine: 'mpv' });
      await invoke('ffmpeg.remove');
      this.isInstalled = false;
    } catch (error) {
      toasts.error(error, 'Impossible de supprimer ffmpeg');
    }
  }

  private async download(): Promise<void> {
    this.isInstalling = true;
    this.ratio = 0;
    try {
      await invoke('ffmpeg.install');
      this.isInstalled = true;
    } finally {
      this.isInstalling = false;
    }
  }

  // <-- L'installeur dépose une demande quand la case ffmpeg était cochée : le téléchargement se fait ici, avec sa progression -->
  private async installIfAsked(): Promise<void> {
    try {
      if (await invoke('ffmpeg.takeInstallRequest')) await this.enable();
    } catch (error) {
      toasts.error(error, 'Impossible de préparer ffmpeg');
    }
  }
}

export const ffmpeg = new Ffmpeg();
