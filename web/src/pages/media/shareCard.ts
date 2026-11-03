/** What the share card shows; every text is already formatted. */
export interface ShareCardContent {
  title: string;
  altTitle: string | null;
  coverUrl: string;
  bannerUrl: string | null;
  /** "12/12", or "12" when the total is unknown. */
  progress: string;
  /** "épisodes vus", "chapitres lus"… */
  progressLabel: string;
  statusLabel: string;
  isCompleted: boolean;
  /** "8/10", "★★★★"…; null when the viewer gave no score. */
  score: string | null;
}

const width = 1200;
const height = 576;
const pixelRatio = 1.5;
const bannerHeight = 200;
const frameBorder = 4;
const frameRadius = 18;
const frameShadow = 7;
const kiraPath = new Path2D('M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z');

type Palette = Record<'milk' | 'paper' | 'collar' | 'mauve' | 'lilac' | 'ink' | 'text' | 'soft' | 'faint' | 'star' | 'thread', string>;

// <-- Le canvas ne lit pas les variables CSS : on prend les jetons du thème affiché -->
function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    milk: token('--colorMilk'),
    paper: token('--colorPaper'),
    collar: token('--colorCollar'),
    mauve: token('--colorMauve'),
    lilac: token('--colorLilac'),
    ink: token('--colorInk'),
    text: token('--textMain'),
    soft: token('--textSoft'),
    faint: token('--textFaint'),
    star: token('--colorStar'),
    thread: token('--colorThread'),
  };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

// <-- Sans Origin, le CDN d'AniList répond sans « Vary » : la copie déjà affichée, sans CORS, bloquerait l'export ; un paramètre force une autre copie -->
function loadAniListImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return loadImage(`${url}${url.includes('?') ? '&' : '?'}ruruka=share`);
}

function drawCover(context: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const sourceWidth = w / scale;
  const sourceHeight = h / scale;
  context.drawImage(image, (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, w, h);
}

function dotGrid(context: CanvasRenderingContext2D, color: string, opacity: number, spacing: number, radius: number, area: [number, number, number, number]) {
  const [left, top, right, bottom] = area;
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = color;
  for (let y = top + spacing / 2; y < bottom; y += spacing) {
    for (let x = left + spacing / 2; x < right; x += spacing) {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function kira(context: CanvasRenderingContext2D, palette: Palette, x: number, y: number, size: number, rotation: number) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(size / 24, size / 24);
  context.translate(-12, -12);
  context.fillStyle = palette.star;
  context.fill(kiraPath);
  context.lineWidth = 2.4;
  context.strokeStyle = palette.ink;
  context.stroke(kiraPath);
  context.restore();
}

/** A sticker-like rounded box: flat fill, ink outline, offset ink shadow. */
function sticker(context: CanvasRenderingContext2D, palette: Palette, fill: string, x: number, y: number, w: number, h: number, radius: number, shadow = 5) {
  context.fillStyle = palette.ink;
  context.beginPath();
  context.roundRect(x + shadow, y + shadow, w, h, radius);
  context.fill();
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(x, y, w, h, radius);
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = palette.ink;
  context.stroke();
}

/** Splits text into at most `maxLines` lines that fit `maxWidth`, ending with "…" when cut. */
function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? '';
  while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function drawBanner(context: CanvasRenderingContext2D, palette: Palette, banner: HTMLImageElement | null) {
  context.fillStyle = palette.mauve;
  context.fillRect(0, 0, width, bannerHeight);
  if (banner) drawCover(context, banner, 0, 0, width, bannerHeight);
  dotGrid(context, palette.ink, 0.25, 7, 1.4, [0, 0, width, bannerHeight]);
  context.fillStyle = palette.ink;
  context.fillRect(0, bannerHeight - 2, width, 4);
}

function drawCard(context: CanvasRenderingContext2D, palette: Palette, cover: HTMLImageElement | null) {
  const cardWidth = 270;
  const cardHeight = 393;
  context.save();
  context.translate(70 + cardWidth / 2, 120 + cardHeight / 2);
  context.rotate((-3 * Math.PI) / 180);
  context.translate(-cardWidth / 2, -cardHeight / 2);
  sticker(context, palette, palette.collar, 0, 0, cardWidth, cardHeight, 20, 8);
  context.save();
  context.beginPath();
  context.roundRect(10, 10, cardWidth - 20, cardHeight - 20, 10);
  context.clip();
  context.fillStyle = palette.mauve;
  context.fillRect(10, 10, cardWidth - 20, cardHeight - 20);
  if (cover) drawCover(context, cover, 10, 10, cardWidth - 20, cardHeight - 20);
  context.restore();
  context.lineWidth = 2;
  context.strokeStyle = palette.ink;
  context.beginPath();
  context.roundRect(10, 10, cardWidth - 20, cardHeight - 20, 10);
  context.stroke();
  context.restore();
}

// <-- Le tampon d'enquête : « Résolu » quand l'anime est fini, sinon le statut de la liste -->
function drawStamp(context: CanvasRenderingContext2D, palette: Palette, label: string) {
  context.save();
  context.translate(1020, bannerHeight - 4);
  context.rotate((7 * Math.PI) / 180);
  context.font = '28px "Mochiy Pop One"';
  const textWidth = context.measureText(label).width;
  const boxWidth = textWidth + 44;
  context.fillStyle = palette.paper;
  context.strokeStyle = palette.thread;
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(-boxWidth / 2, -32, boxWidth, 64, 12);
  context.fill();
  context.stroke();
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(-boxWidth / 2 + 6, -26, boxWidth - 12, 52, 8);
  context.stroke();
  context.fillStyle = palette.thread;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, 0, 2);
  context.restore();
}

function drawTitle(context: CanvasRenderingContext2D, palette: Palette, content: ShareCardContent): number {
  const left = 390;
  const maxWidth = 760;
  // <-- Un long titre rapetisse avant de passer sur trois lignes -->
  let fontSize = 50;
  context.font = `${fontSize}px "Mochiy Pop One"`;
  let lines = wrapLines(context, content.title, maxWidth, 3);
  while (lines.length > 2 && fontSize > 34) {
    fontSize -= 4;
    context.font = `${fontSize}px "Mochiy Pop One"`;
    lines = wrapLines(context, content.title, maxWidth, 3);
  }
  context.fillStyle = palette.text;
  context.textBaseline = 'alphabetic';
  let y = bannerHeight + 110;
  for (const line of lines) {
    context.fillText(line, left, y);
    y += fontSize * 1.2;
  }
  if (!content.altTitle) return y;
  context.font = '30px "Patrick Hand"';
  context.fillStyle = palette.soft;
  context.fillText(wrapLines(context, content.altTitle, maxWidth, 1)[0] ?? '', left, y - 4);
  return y + 36;
}

function drawFacts(context: CanvasRenderingContext2D, palette: Palette, content: ShareCardContent, top: number) {
  let x = 390;
  const y = Math.min(Math.max(top, 400), 452);
  context.textBaseline = 'middle';

  context.font = '40px "Courier Prime"';
  const progressWidth = context.measureText(content.progress).width;
  context.font = '26px "Patrick Hand"';
  const labelWidth = context.measureText(content.progressLabel).width;
  const pillWidth = progressWidth + labelWidth + 64;
  sticker(context, palette, palette.paper, x, y, pillWidth, 70, 35);
  context.fillStyle = palette.text;
  context.font = '40px "Courier Prime"';
  context.fillText(content.progress, x + 28, y + 37);
  context.fillStyle = palette.soft;
  context.font = '26px "Patrick Hand"';
  context.fillText(content.progressLabel, x + 40 + progressWidth, y + 38);
  x += pillWidth + 30;

  if (!content.score) return;
  context.font = '36px "Mochiy Pop One"';
  const scoreWidth = context.measureText(content.score).width;
  const scorePillWidth = scoreWidth + 108;
  sticker(context, palette, palette.star, x, y, scorePillWidth, 70, 35);
  kira(context, palette, x + 46, y + 35, 32, 0.2);
  context.fillStyle = palette.text;
  context.fillText(content.score, x + 78, y + 38);
}

function drawSignature(context: CanvasRenderingContext2D, palette: Palette) {
  context.textBaseline = 'alphabetic';
  context.fillStyle = palette.faint;
  context.font = '18px "Mochiy Pop One"';
  context.fillText('Ruruka', 36, height - 22);
}

/** Draws the "case closed" card as a PNG, in the theme currently shown. */
export async function renderShareCard(content: ShareCardContent): Promise<Blob> {
  await Promise.all(['40px "Mochiy Pop One"', '30px "Patrick Hand"', '40px "Courier Prime"'].map((font) => document.fonts.load(font)));
  const [cover, banner] = await Promise.all([loadAniListImage(content.coverUrl), loadAniListImage(content.bannerUrl)]);

  const canvas = document.createElement('canvas');
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Le dessin de la carte est indisponible.');
  context.scale(pixelRatio, pixelRatio);

  const palette = readPalette();
  context.fillStyle = palette.milk;
  context.fillRect(0, 0, width, height);
  dotGrid(context, palette.lilac, 0.32, 22, 1.3, [0, bannerHeight, width, height]);
  drawBanner(context, palette, banner);
  drawCard(context, palette, cover);
  drawStamp(context, palette, content.isCompleted ? 'Résolu' : content.statusLabel);
  const factsTop = drawTitle(context, palette, content);
  drawFacts(context, palette, content, factsTop);
  drawSignature(context, palette);

  kira(context, palette, 352, 150, 30, 0.3);
  kira(context, palette, 1150, 360, 26, -0.2);
  kira(context, palette, 1090, 530, 22, 0.1);

  const framed = frame(canvas, palette);
  return new Promise((resolve, reject) => {
    framed.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Impossible de créer l’image.'))), 'image/png');
  });
}

// <-- Le PNG porte lui-même son cadre d'autocollant : coins arrondis, contour d'encre, ombre décalée, fond transparent autour -->
function frame(card: HTMLCanvasElement, palette: Palette): HTMLCanvasElement {
  const outerWidth = width + frameBorder * 2;
  const outerHeight = height + frameBorder * 2;
  const canvas = document.createElement('canvas');
  canvas.width = (outerWidth + frameShadow) * pixelRatio;
  canvas.height = (outerHeight + frameShadow) * pixelRatio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Le dessin de la carte est indisponible.');
  context.scale(pixelRatio, pixelRatio);

  context.fillStyle = palette.ink;
  context.beginPath();
  context.roundRect(frameShadow, frameShadow, outerWidth, outerHeight, frameRadius);
  context.fill();
  context.beginPath();
  context.roundRect(0, 0, outerWidth, outerHeight, frameRadius);
  context.fill();

  context.beginPath();
  context.roundRect(frameBorder, frameBorder, width, height, frameRadius - frameBorder);
  context.clip();
  context.drawImage(card, frameBorder, frameBorder, width, height);
  return canvas;
}
