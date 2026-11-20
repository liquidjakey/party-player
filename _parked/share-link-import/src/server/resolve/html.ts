// Small HTML helpers: read <meta> tags and <title>, clean store-style titles.

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Reads <meta property|name="key" content="..."> in either attribute order. */
export function readMeta(html: string, key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key.toLowerCase()) continue;
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value != null) return decodeEntities(value).trim() || null;
  }
  return null;
}

export function readTitleTag(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() || null : null;
}

const STORE = '(?:Spotify|Apple Music|Amazon Music|TIDAL|Deezer|SoundCloud|YouTube Music)';
const SUFFIXES = [
  new RegExp(`\\s*[|\\-–—]\\s*${STORE}\\s*$`, 'i'),
  new RegExp(`\\s+on\\s+${STORE}\\s*$`, 'i'),
  /\s*-\s*(?:Single|EP)\s*$/i,
  /^Listen to\s+/i,
];

/** Turns a page title into { title, artist }. Returns null when nothing is left. */
export function splitTitle(raw: string): { title: string; artist: string | null } | null {
  let text = raw.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) for (const re of SUFFIXES) text = text.replace(re, '').trim();

  const songBy = /^(.+?)\s+[-–—]\s+(?:song|single)(?: and lyrics)? by\s+(.+)$/i.exec(text);
  if (songBy) return { title: songBy[1].trim(), artist: songBy[2].trim() };

  const byIdx = text.lastIndexOf(' by ');
  if (byIdx > 0 && byIdx < text.length - 4) {
    return { title: text.slice(0, byIdx).trim(), artist: text.slice(byIdx + 4).trim() };
  }
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(text);
  if (dash) return { title: dash[1].trim(), artist: dash[2].trim() };

  return text ? { title: text, artist: null } : null;
}
