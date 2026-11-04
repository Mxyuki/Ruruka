import { invoke, type UpdateInfo } from '../lib/bridge';
import { toasts } from './toasts.svelte';

class Updates {
  available = $state<UpdateInfo | null>(null);
  isInstalling = $state(false);
  isChecking = $state(false);

  /** Asks the host whether GitHub has a newer release; sets `available` when it does. */
  async check(): Promise<void> {
    await this.fetchLatest();
  }

  /** Same check on request: the update dialog opens when there is one, otherwise a toast says so. */
  async checkNow(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;
    const hasAnswer = await this.fetchLatest();
    this.isChecking = false;
    if (hasAnswer && !this.available) toasts.success('Ruruka est à jour !');
  }

  private async fetchLatest(): Promise<boolean> {
    try {
      this.available = await invoke('update.check');
      return true;
    } catch (error) {
      toasts.error(error, 'Vérification des mises à jour');
      return false;
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
