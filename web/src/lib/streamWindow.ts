const mebibyte = 1024 * 1024;
/** Container indexes live at both ends of a file, and the player reads them before any image. */
const fileEdgeBytes = 16 * mebibyte;
/** The player keeps 30 s ahead: three minutes covers bitrate peaks without sending the rest of the episode. */
const aheadSeconds = 180;
const minimumAheadBytes = 64 * mebibyte;

export interface StreamPosition {
  positionSeconds: number;
  durationSeconds: number;
}

/** True when a friend may read these bytes now: a stream follows the episode, it doesn't hand out the file in advance. */
export function isRangeAllowed(offset: number, length: number, fileSize: number, position: StreamPosition): boolean {
  if (offset < 0 || length <= 0 || offset >= fileSize) return false;
  if (offset >= fileSize - fileEdgeBytes) return true;
  const end = offset + length;
  if (end <= fileEdgeBytes) return true;
  const { positionSeconds, durationSeconds } = position;
  const bytesPerSecond = durationSeconds > 0 ? fileSize / durationSeconds : 0;
  const reachedBytes = positionSeconds * bytesPerSecond;
  return end <= reachedBytes + Math.max(aheadSeconds * bytesPerSecond, minimumAheadBytes);
}
