import { safeFetchJson } from './safe-fetch';
import type { ResolveResult } from './index';

export function isSoundCloudHost(host: string): boolean {
  return host === 'soundcloud.com' || host.endsWith('.soundcloud.com') || host === 'snd.sc';
}

export async function resolveSoundCloud(url: URL, fetchFn: typeof fetch): Promise<ResolveResult> {
  const data = await safeFetchJson<{ title?: string; author_name?: string }>(
    `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`,
    fetchFn,
  );
  const raw = data?.title?.trim();
  if (!raw) return { kind: 'unknown' };
  const at = raw.lastIndexOf(' by ');
  if (at > 0) {
    return { kind: 'song', service: 'soundcloud', title: raw.slice(0, at).trim(), artist: raw.slice(at + 4).trim() };
  }
  return { kind: 'song', service: 'soundcloud', title: raw, artist: data?.author_name?.trim() || null };
}
