import { invoke, type UpdateInfo } from '../lib/bridge';
import { toasts } from './toasts.svelte';

class Updates {
  available = $state<UpdateInfo | null>(null);
  isInstalling = $state(false);

  /** Asks the host whether GitHub has a newer release; sets `available` when it does. */
  async check(): Promise<void> {
    try {
      this.available = await invoke('update.check');
    } catch (error) {
      toasts.error(error, 'Vérification des mises à jour');
    }
  }

  dismiss(): void {
    this.available = null;
  }

  /** Downloads the installer; the host then quits and lets it replace the app. */
  async install(): Promise<void> {
    this.isInstalling = true;
    try {
      await invoke('update.install');
    } catch (error) {
      this.isInstalling = false;
      toasts.error(error, 'La mise à jour a échoué');
    }
  }
}

export const updates = new Updates();
