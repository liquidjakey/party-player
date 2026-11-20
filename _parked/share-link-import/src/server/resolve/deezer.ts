import { safeFetch, safeFetchJson } from './safe-fetch';
import type { ResolveResult } from './index';

const TRACK = /deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?track\/(\d+)/i;

export function isDeezerHost(host: string): boolean {
  return host === 'deezer.com' || host.endsWith('.deezer.com') || host === 'deezer.page.link';
}

export async function resolveDeezer(url: URL, fetchFn: typeof fetch): Promise<ResolveResult> {
  let id = TRACK.exec(url.hostname + url.pathname)?.[1] ?? null;
  if (!id) {
    // Short link (link.deezer.com, deezer.page.link): follow it, then look again.
    const res = await safeFetch(url.toString(), fetchFn);
    if (res) id = TRACK.exec(res.finalUrl)?.[1] ?? TRACK.exec(res.body)?.[1] ?? null;
  }
  if (!id) return { kind: 'unknown' };

  const data = await safeFetchJson<{ title?: string; artist?: { name?: string }; error?: unknown }>(
    `https://api.deezer.com/track/${id}`,
    fetchFn,
  );
  if (!data?.title || data.error) return { kind: 'unknown' };
  return { kind: 'song', service: 'deezer', title: data.title, artist: data.artist?.name ?? null };
}
