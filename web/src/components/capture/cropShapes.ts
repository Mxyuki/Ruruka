export interface Shape {
  key: string;
  label: string;
  /** Width / height in pixels; null is free. */
  ratio: number | null;
}

export const freeShape: Shape = { key: 'free', label: 'Libre', ratio: null };

export const shapes: Shape[] = [
  freeShape,
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '1:1', label: 'Carré', ratio: 1 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
];
