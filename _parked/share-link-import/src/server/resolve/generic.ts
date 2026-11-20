import { readMeta, readTitleTag, splitTitle } from './html';
import { safeFetch } from './safe-fetch';
import type { ResolveResult } from './index';

// A JavaScript-only page (e.g. Amazon Music) shows just the store name: treat it as unreadable.
const STORE_NAMES = /^(amazon music|amazon|tidal|spotify|apple music|deezer|soundcloud|youtube( music)?)$/i;

type GenericService = 'tidal' | 'amazon' | 'other';

export function genericService(host: string): GenericService {
  if (host === 'tidal.com' || host.endsWith('.tidal.com')) return 'tidal';
  if (/^music\.amazon\.[a-z.]+$/.test(host)) return 'amazon';
  return 'other';
}

/** Reads og:title (or <title>) from any public page and splits it into song + artist. */
export async function resolveGeneric(url: URL, fetchFn: typeof fetch): Promise<ResolveResult> {
  const page = await safeFetch(url.toString(), fetchFn);
  if (!page) return { kind: 'unknown' };
  const raw = readMeta(page.body, 'og:title') ?? readTitleTag(page.body);
  const parsed = raw ? splitTitle(raw) : null;
  if (!parsed || STORE_NAMES.test(parsed.title.trim())) return { kind: 'unknown' };
  return { kind: 'song', service: genericService(url.hostname.toLowerCase()), ...parsed };
}
