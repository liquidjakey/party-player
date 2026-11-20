import { readMeta } from './html';
import { safeFetch, safeFetchJson } from './safe-fetch';
import type { ResolveResult } from './index';

// Spotify serves a JS-only shell (no og tags) to browser User-Agents, but full og tags to
// link-preview bots. Checked live 2026-11-19.
const PREVIEW_UA = 'facebookexternalhit/1.1';

const TRACK_PATH = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?track\/([A-Za-z0-9]{10,32})/i;

export function isSpotifyHost(host: string): boolean {
  return host === 'open.spotify.com' || host === 'spotify.link' || host.endsWith('.spotify.link');
}

function trackIdFrom(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'open.spotify.com') return null;
    return TRACK_PATH.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function findTrackId(url: URL, fetchFn: typeof fetch): Promise<string | null> {
  const direct = trackIdFrom(url.toString());
  if (direct) return direct;
  if (url.hostname === 'open.spotify.com') return null;
  // Short link: follow redirects, or find the track URL inside the landing page.
  const res = await safeFetch(url.toString(), fetchFn);
  if (!res) return null;
  return (
    trackIdFrom(res.finalUrl) ??
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{10,32})/i.exec(res.body)?.[1] ??
    null
  );
}

export async function resolveSpotify(url: URL, fetchFn: typeof fetch): Promise<ResolveResult> {
  const id = await findTrackId(url, fetchFn);
  if (!id) return { kind: 'unknown' };
  const trackUrl = `https://open.spotify.com/track/${id}`;

  const page = await safeFetch(trackUrl, fetchFn, { headers: { 'User-Agent': PREVIEW_UA } });
  const title = page ? readMeta(page.body, 'og:title') : null;
  if (page && title) {
    const desc = readMeta(page.body, 'og:description');
    const artist =
      readMeta(page.body, 'music:musician_description') ??
      (desc && desc.includes(' · ') ? desc.split(' · ')[0].trim() : null);
    return { kind: 'song', service: 'spotify', title, artist: artist || null };
  }

  const oembed = await safeFetchJson<{ title?: string }>(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`,
    fetchFn,
  );
  if (oembed?.title) return { kind: 'song', service: 'spotify', title: oembed.title, artist: null };
  return { kind: 'unknown' };
}
