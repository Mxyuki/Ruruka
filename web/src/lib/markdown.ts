import { Marked } from 'marked';
import { sanitizeHtml } from './html';

const parser = new Marked({ gfm: true, breaks: true });
const blockToken = /<p>RURUKABLOCK(\d+)X<\/p>|RURUKABLOCK(\d+)X/g;

/**
 * Renders raw AniList markdown the way anilist.co does in the browser (its `asHtml` output
 * is only half converted), then sanitizes it. Used for the profile and the editor preview.
 */
export function renderAniListMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return '';
  const blocks: string[] = [];
  return sanitizeHtml(resolveBlocks(toHtml(markdown, blocks), blocks));
}

// <-- Centrages et spoilers sont rendus à part puis recollés : marked couperait leurs balises à chaque paragraphe -->
function toHtml(markdown: string, blocks: string[]): string {
  const text = expandAniListSyntax(markdown)
    .replace(/~~~([\s\S]*?)~~~/g, (_, inner: string) => storeWrapped(blocks, inner, '<div align="center">', '</div>'))
    .replace(/<center>([\s\S]*?)<\/center>/gi, (_, inner: string) => storeWrapped(blocks, inner, '<div align="center">', '</div>'))
    // <-- Un spoiler ouvert dans un bloc centré et fermé après lui (courant sur AniList) court jusqu'à la fin du bloc, comme dans le navigateur -->
    .replace(/~!([\s\S]*?)(?:!~|$)/g, (_, inner: string) => storeWrapped(blocks, inner, '<span class="markdown_spoiler">', '</span>'))
    .replace(/!~/g, '');
  return parser.parse(text, { async: false });
}

// <-- Sur une seule ligne, le bloc reste dans sa ligne : « # ~~~Titre~~~ » donne un titre centré -->
function storeWrapped(blocks: string[], inner: string, open: string, close: string): string {
  const isMultiline = inner.trim().includes('\n');
  const content = isMultiline ? toHtml(inner, blocks) : parser.parseInline(inner, { async: false });
  return storeBlock(blocks, `${open}${content}${close}`, isMultiline);
}

function storeBlock(blocks: string[], html: string, isBlock: boolean): string {
  const token = `RURUKABLOCK${blocks.push(html) - 1}X`;
  return isBlock ? `\n\n${token}\n\n` : token;
}

function resolveBlocks(html: string, blocks: string[]): string {
  return html.replace(blockToken, (_, blockIndex?: string, inlineIndex?: string) => resolveBlocks(blocks[Number(blockIndex ?? inlineIndex)] ?? '', blocks));
}

// <-- Raccourcis propres à AniList : images à largeur, vidéos, et titres écrits sans espace (« #Titre ») -->
function expandAniListSyntax(markdown: string): string {
  return markdown
    .replace(/img(\d+%?)?\s?\((https?:\/\/[^\s)"]+)\)/gi, (_, width: string | undefined, src: string) => `<img src="${src}"${width ? ` width="${width}"` : ''}>`)
    .replace(/youtube\s?\(([^\s)"]+)\)/gi, '<span class="youtube" id="$1"></span>')
    .replace(/webm\s?\((https?:\/\/[^\s)"]+)\)/gi, '<video src="$1"></video>')
    .replace(/^(#{1,5})(?=[^#\s])/gm, '$1 ');
}
