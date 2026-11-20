import { safeFetchJson } from './safe-fetch';
import type { ResolveResult } from './index';

interface LookupResult {
  wrapperType?: string;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
}

export function isAppleHost(host: string): boolean {
  return host === 'music.apple.com' || host === 'itunes.apple.com';
}

export async function resolveApple(url: URL, fetchFn: typeof fetch): Promise<ResolveResult> {
  const parts = url.pathname.split('/').filter(Boolean);
  const cc = /^[a-z]{2}$/i.test(parts[0] ?? '') ? parts[0].toLowerCase() : null;
  const rest = cc ? parts.slice(1) : parts;
  const last = rest[rest.length - 1] ?? '';
  const pathId = /^(?:id)?(\d+)$/.exec(last)?.[1] ?? null;

  const trackId = url.searchParams.get('i') ?? (rest[0] === 'song' ? pathId : null);
  const albumId = rest[0] === 'album' ? pathId : null;
  const id = trackId ?? albumId;
  if (!id || !/^\d+$/.test(id)) return { kind: 'unknown' };

  const base = `https://itunes.apple.com/lookup?id=${id}`;
  const tries = cc ? [`${base}&country=${cc}`, base] : [base];
  for (const lookup of tries) {
    const data = await safeFetchJson<{ results?: LookupResult[] }>(lookup, fetchFn);
    const hit = data?.results?.[0];
    if (!hit) continue;
    const title = trackId ? hit.trackName : hit.collectionName;
    if (title) return { kind: 'song', service: 'apple', title, artist: hit.artistName ?? null };
  }
  return { kind: 'unknown' };
}
