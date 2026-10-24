import { internalPathFor } from './routes';

const allowedTags = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'BR', 'HR', 'P', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SPAN', 'DIV',
  'CENTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'CODE', 'PRE', 'SUP', 'SUB', 'IMG',
]);
const droppedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'FORM', 'INPUT']);
const webUrl = /^https?:\/\//;
const youtubeIdPattern = /^[\w-]{11}$/;
const youtubeUrlPattern = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;

/**
 * Keeps AniList's markup (formatting, links, images, videos, spoilers, centered blocks) and drops
 * everything else, so API text can be rendered with {@html} safely.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  const document = new DOMParser().parseFromString(`<body>${expandAniListMarkdown(html)}</body>`, 'text/html');
  cleanChildren(document.body);
  return document.body.innerHTML;
}

/**
 * AniList's `asHtml` leaves raw markdown inside <center> blocks and inside links wrapping
 * images; its website renders those client-side, so this does the same.
 */
function expandAniListMarkdown(html: string): string {
  return html
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, restoreCenterFence)
    .replace(/<center>([\s\S]*?)<\/center>/gi, (_, inner: string) => `<center>${renderLooseMarkdown(inner)}</center>`)
    .replace(/\[((?:[^[\]]|<img[^>]*>)*)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

// <-- `~~~` centre le texte sur AniList, mais asHtml le lit comme un bloc de code et échappe tout son contenu -->
function restoreCenterFence(codeBlock: string, escapedInner: string): string {
  const inner = new DOMParser().parseFromString(escapedInner, 'text/html').body.textContent ?? '';
  if (!/<(img|video|div|center|a)\b/i.test(inner)) return codeBlock;
  return `<div align="center">${renderLooseMarkdown(inner.replace(/~~~/g, ''))}</div>`;
}

function renderLooseMarkdown(text: string): string {
  return text
    .replace(/~!([\s\S]*?)!~/g, '<span class="markdown_spoiler">$1</span>')
    .replace(/^#{1,5}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n/g, '<br>');
}

// <-- Nettoyage en profondeur d'abord, pour que les enfants soient propres avant de déballer leur parent -->
function cleanChildren(parent: Node): void {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (!(node instanceof Element) || droppedTags.has(node.tagName)) {
      node.remove();
      continue;
    }
    if (node.classList.contains('youtube')) {
      node.replaceWith(youtubeEmbed(node.id));
      continue;
    }
    if (node.tagName === 'VIDEO') {
      node.replaceWith(videoEmbed(node));
      continue;
    }
    cleanChildren(node);
    if (node.classList.contains('markdown_spoiler')) node.replaceWith(spoiler(node));
    else if (allowedTags.has(node.tagName)) cleanAttributes(node);
    else node.replaceWith(...node.childNodes);
  }
}

// <-- Lecteur YouTube intégré comme sur AniList ; `loading="lazy"` ne le charge qu'une fois à l'écran -->
function youtubeEmbed(idOrUrl: string): Node {
  const id = youtubeIdPattern.test(idOrUrl) ? idOrUrl : idOrUrl.match(youtubeUrlPattern)?.[1];
  if (!id) return webUrl.test(idOrUrl) ? embedLink(idOrUrl, '▶ Vidéo YouTube') : document.createTextNode('');
  const frame = document.createElement('iframe');
  frame.setAttribute('src', `https://www.youtube-nocookie.com/embed/${id}`);
  frame.setAttribute('title', 'Vidéo YouTube');
  frame.setAttribute('loading', 'lazy');
  frame.setAttribute('allow', 'encrypted-media; fullscreen; picture-in-picture');
  frame.setAttribute('allowfullscreen', '');
  frame.className = 'youtube-embed';
  return frame;
}

// <-- Les webm d'AniList servent de GIF : lecture auto, en boucle et sans son -->
function videoEmbed(source: Element): Node {
  const src = source.getAttribute('src') ?? source.querySelector('source')?.getAttribute('src') ?? '';
  if (!webUrl.test(src)) return document.createTextNode('');
  const video = document.createElement('video');
  video.setAttribute('src', src);
  for (const flag of ['autoplay', 'loop', 'muted', 'playsinline']) video.setAttribute(flag, '');
  return video;
}

// <-- Comme sur AniList, tout le contenu est caché (images comprises) jusqu'au clic sur l'étiquette -->
function spoiler(source: Element): HTMLSpanElement {
  const toggle = document.createElement('button');
  toggle.setAttribute('type', 'button');
  toggle.className = 'spoiler-toggle';
  toggle.textContent = 'Spoiler, clique pour voir';
  const content = document.createElement('span');
  content.className = 'spoiler-content';
  content.append(...source.childNodes);
  const wrapper = document.createElement('span');
  wrapper.className = 'spoiler';
  wrapper.append(toggle, content);
  return wrapper;
}

function embedLink(url: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'embed-link';
  link.textContent = label;
  return link;
}

function cleanAttributes(element: Element): void {
  const href = element.getAttribute('href');
  const src = element.getAttribute('src');
  const width = element.getAttribute('width');
  const isCentered = element.getAttribute('align') === 'center';
  for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);

  if (isCentered) element.className = 'centered';

  if (element.tagName === 'IMG') {
    if (!src || !webUrl.test(src)) return element.remove();
    element.setAttribute('src', src);
    element.setAttribute('loading', 'lazy');
    element.setAttribute('referrerpolicy', 'no-referrer');
    if (width && /^\d+%?$/.test(width)) element.setAttribute('width', width);
    return;
  }

  if (element.tagName !== 'A' || !href) return;
  const internal = internalPathFor(href);
  if (internal) {
    element.setAttribute('href', `#${internal}`);
  } else if (webUrl.test(href)) {
    element.setAttribute('href', href);
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

/** Plain text for places where markup can't be shown (tooltips, single-line previews). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
}
