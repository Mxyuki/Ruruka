/** A rectangle inside a frame, as fractions (0 to 1) of its width and height. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const fullFrame: CropRect = { x: 0, y: 0, width: 1, height: 1 };

const minimumSize = 0.05;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

export const isFullFrame = (rect: CropRect): boolean => rect.x <= 0 && rect.y <= 0 && rect.width >= 1 && rect.height >= 1;

/** A width / height ratio in pixels, as the same ratio in frame fractions. */
export const ratioInFractions = (pixelRatio: number, frameWidth: number, frameHeight: number): number => (pixelRatio * frameHeight) / frameWidth;

export function moveRect(rect: CropRect, deltaX: number, deltaY: number): CropRect {
  return {
    ...rect,
    x: clamp(rect.x + deltaX, 0, 1 - rect.width),
    y: clamp(rect.y + deltaY, 0, 1 - rect.height),
  };
}

/** The largest rectangle of this ratio (width / height, in fractions) that fits in `rect`, around its centre. */
export function fitRatio(rect: CropRect, ratio: number): CropRect {
  const width = Math.min(rect.width, rect.height * ratio);
  const height = width / ratio;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/**
 * Drags a handle by a distance in frame fractions. With a `ratio` (width / height in fractions) only the corners
 * resize, and they keep it: the opposite corner stays put.
 */
export function resizeRect(rect: CropRect, handle: CropHandle, deltaX: number, deltaY: number, ratio: number | null): CropRect {
  return ratio === null ? resizeFree(rect, handle, deltaX, deltaY) : resizeKeepingRatio(rect, handle, deltaX, deltaY, ratio);
}

function resizeFree(rect: CropRect, handle: CropHandle, deltaX: number, deltaY: number): CropRect {
  let left = rect.x;
  let right = rect.x + rect.width;
  let top = rect.y;
  let bottom = rect.y + rect.height;
  if (handle.includes('w')) left = clamp(left + deltaX, 0, right - minimumSize);
  if (handle.includes('e')) right = clamp(right + deltaX, left + minimumSize, 1);
  if (handle.includes('n')) top = clamp(top + deltaY, 0, bottom - minimumSize);
  if (handle.includes('s')) bottom = clamp(bottom + deltaY, top + minimumSize, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function resizeKeepingRatio(rect: CropRect, handle: CropHandle, deltaX: number, deltaY: number, ratio: number): CropRect {
  const isLeft = handle.includes('w');
  const isTop = handle.includes('n');
  const anchorX = isLeft ? rect.x + rect.width : rect.x;
  const anchorY = isTop ? rect.y + rect.height : rect.y;
  const cornerX = (isLeft ? rect.x : rect.x + rect.width) + deltaX;
  const cornerY = (isTop ? rect.y : rect.y + rect.height) + deltaY;

  const wantedWidth = Math.max(Math.abs(cornerX - anchorX), Math.abs(cornerY - anchorY) * ratio, minimumSize);
  const roomWidth = isLeft ? anchorX : 1 - anchorX;
  const roomHeight = isTop ? anchorY : 1 - anchorY;
  const width = Math.min(wantedWidth, roomWidth, roomHeight * ratio);
  const height = width / ratio;
  return {
    x: isLeft ? anchorX - width : anchorX,
    y: isTop ? anchorY - height : anchorY,
    width,
    height,
  };
}
