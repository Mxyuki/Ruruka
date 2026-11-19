/** The host's sync point as it travelled: when it left, and how old its position already was. */
interface TravelledPoint {
  sentAt: number;
  ageSeconds: number;
  isPaused: boolean;
}

/** One round trip to the host: when it left here, what the host's clock read on arrival, and when the answer came back. */
interface ClockProbe {
  sentAt: number;
  hostTime: number;
  receivedAt: number;
}

const recentTransitCount = 30;
// <-- Sans mesure, le plus court trajet vu est presque tout de l'écart entre les deux horloges : seul le surplus est un vrai retard -->
const minimumLatencySeconds = 0.05;
const maxJitterSeconds = 3;
const maxTravelSeconds = 5;

/**
 * Tells how far the host's position has moved since a sync point was taken. Two PCs never agree on the
 * time, so a few round trips at the start measure the gap between the clocks; the best (shortest) one
 * wins, as a short trip leaves the least room for an uneven way back. Until one answers, the delay is
 * read against the fastest trip recently seen instead.
 */
export class SyncClock {
  private transitsMs: number[] = [];
  private measure: { offsetMs: number; roundTripMs: number } | null = null;

  /** Forgets the measured gap, before a new series of probes. */
  startCalibration(): void {
    this.measure = null;
  }

  addProbe({ sentAt, hostTime, receivedAt }: ClockProbe): void {
    const roundTripMs = receivedAt - sentAt;
    if (roundTripMs < 0 || (this.measure && roundTripMs >= this.measure.roundTripMs)) return;
    // <-- L'hôte a lu son heure au milieu du trajet : ce qu'il lisait moins notre heure à ce moment-là est l'écart des horloges -->
    this.measure = { offsetMs: hostTime - (sentAt + roundTripMs / 2), roundTripMs };
  }

  /** Seconds to add to the point's position: the age it had when sent, plus the trip. Nothing while the host is paused. */
  lagSeconds(point: TravelledPoint, receivedAt = Date.now()): number {
    if (point.isPaused) return 0;
    if (this.measure) {
      const travelSeconds = (receivedAt - (point.sentAt - this.measure.offsetMs)) / 1000;
      return point.ageSeconds + Math.min(maxTravelSeconds, Math.max(0, travelSeconds));
    }
    const transitMs = receivedAt - point.sentAt;
    this.transitsMs = [...this.transitsMs, transitMs].slice(-recentTransitCount);
    const jitterSeconds = (transitMs - Math.min(...this.transitsMs)) / 1000;
    return point.ageSeconds + minimumLatencySeconds + Math.min(maxJitterSeconds, Math.max(0, jitterSeconds));
  }

  reset(): void {
    this.transitsMs = [];
    this.measure = null;
  }
}
