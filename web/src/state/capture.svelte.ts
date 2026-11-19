import { invoke, on, type CaptureOffer, type ClipPreviewRequest, type ClipRequest, type ClipSaved } from '../lib/bridge';
import { toasts } from './toasts.svelte';

/** The capture workshop: the frame the player's capture button froze, and the clip being cut from it. */
class Capture {
  offer = $state<CaptureOffer | null>(null);
  isCutting = $state(false);
  /** How far the clip is cut, 0 to 1. */
  cutRatio = $state(0);
  savedClip = $state<ClipSaved | null>(null);

  init(): void {
    on('capture.ready', (offer) => {
      this.offer = offer;
      this.savedClip = null;
      this.cutRatio = 0;
    });
    on('capture.failed', ({ message }) => toasts.error(message));
    on('capture.clipProgress', ({ ratio }) => {
      this.cutRatio = ratio;
    });
  }

  /** The frame as PNG in base64, taken at the video's own resolution. */
  loadFrame(withSubtitles: boolean): Promise<string | null> {
    return invoke('capture.getFrame', { withSubtitles });
  }

  /** A small MP4 of the range, taken from the original file, as base64. */
  loadPreview(request: ClipPreviewRequest): Promise<string | null> {
    return invoke('capture.previewClip', request);
  }

  async saveClip(request: ClipRequest): Promise<void> {
    this.isCutting = true;
    this.cutRatio = 0;
    this.savedClip = null;
    try {
      this.savedClip = await invoke('capture.saveClip', request);
    } catch (error) {
      toasts.error(error, 'Impossible de découper le clip');
    } finally {
      this.isCutting = false;
    }
  }

  cancelClip(): void {
    invoke('capture.cancelClip').catch((error) => toasts.error(error, 'Impossible d’arrêter le découpage'));
  }

  close(): void {
    if (this.isCutting) this.cancelClip();
    this.offer = null;
    invoke('capture.discard').catch((error) => toasts.error(error, 'Impossible de ranger les images temporaires'));
  }
}

export const capture = new Capture();
