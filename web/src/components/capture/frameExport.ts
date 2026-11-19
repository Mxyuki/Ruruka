import type { CropRect } from '../../lib/cropRect';

/** A PNG made by the host, in base64, as a blob the page can show and draw. */
export async function pngFromBase64(base64: string): Promise<Blob> {
  const response = await fetch(`data:image/png;base64,${base64}`);
  return response.blob();
}

/** A JPEG picture made by the host, in base64, as a blob the page can show. */
export async function jpegFromBase64(base64: string): Promise<Blob> {
  const response = await fetch(`data:image/jpeg;base64,${base64}`);
  return response.blob();
}

/** The preview clip made by the host, in base64, as a blob a <video> can play. */
export async function mp4FromBase64(base64: string): Promise<Blob> {
  const response = await fetch(`data:video/mp4;base64,${base64}`);
  return response.blob();
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Impossible de lire l’image.'));
    image.src = url;
  });
}

/** Cuts the crop out of the frame at its own resolution: nothing is scaled, so nothing is lost. */
export async function cropToPng(url: string, crop: CropRect): Promise<Blob> {
  const image = await loadImage(url);
  const width = Math.max(1, Math.round(crop.width * image.naturalWidth));
  const height = Math.max(1, Math.round(crop.height * image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer l’image.');
  context.drawImage(image, Math.round(crop.x * image.naturalWidth), Math.round(crop.y * image.naturalHeight), width, height, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Impossible de créer l’image.'))), 'image/png');
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Impossible de lire l’image.'));
    reader.readAsDataURL(blob);
  });
}
