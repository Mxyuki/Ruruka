import { internalPathFor } from './routes';

const allowedTags = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'BR', 'HR', 'P', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SPAN', 'DIV',
  'CENTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'CODE', 'PRE', 'SUP', 'SUB', 'IMG',
]);
const droppedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'FORM', 'INPUT']);
const webUrl = /^https?:\/\//;

/**
 * Keeps AniList's markup (formatting, links, images, spoilers, centered blocks) and drops
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
      node.replaceWith(youtubeLink(node.id));
      continue;
    }
    if (node.tagName === 'VIDEO') {
      node.replaceWith(videoLink(node));
      continue;
    }
    cleanChildren(node);
    if (allowedTags.has(node.tagName)) cleanAttributes(node);
    else node.replaceWith(...node.childNodes);
  }
}

// <-- Les lecteurs intégrés sont lourds : un lien vers le navigateur garde les profils légers -->
function youtubeLink(idOrUrl: string): HTMLAnchorElement {
  const url = webUrl.test(idOrUrl) ? idOrUrl : `https://www.youtube.com/watch?v=${encodeURIComponent(idOrUrl)}`;
  return embedLink(url, '▶ Vidéo YouTube');
}

function videoLink(video: Element): Node {
  const src = video.getAttribute('src') ?? video.querySelector('source')?.getAttribute('src') ?? '';
  if (!webUrl.test(src)) return document.createTextNode('');
  return embedLink(src, '▶ Vidéo');
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
  const isSpoiler = element.classList.contains('markdown_spoiler');
  const isCentered = element.getAttribute('align') === 'center';
  for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);

  if (isSpoiler) element.className = 'spoiler';
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
