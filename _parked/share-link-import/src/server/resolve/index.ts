// Design Ref: §4.2 share-link reader contract
// Reads a "share song" link from any music app. Returns a YouTube video ID or a title + artist.

import { parseYouTubeUrl } from '@/domain/youtube-url';
import { isAppleHost, resolveApple } from './apple';
import { isDeezerHost, resolveDeezer } from './deezer';
import { resolveGeneric } from './generic';
import { checkUrl } from './safe-fetch';
import { isSoundCloudHost, resolveSoundCloud } from './soundcloud';
import { isSpotifyHost, resolveSpotify } from './spotify';

export type ResolveResult =
  | { kind: 'youtube'; videoId: string }
  | {
      kind: 'song';
      service: 'spotify' | 'apple' | 'deezer' | 'soundcloud' | 'tidal' | 'amazon' | 'other';
      title: string;
      artist: string | null;
    }
  | { kind: 'unknown' };

/** Pulls the first http(s) URL out of share text such as "Listen to X on Spotify https://...". */
export function extractUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"'`]+/i.exec(text);
  return m ? m[0].replace(/[),.;!?\]]+$/, '') : null;
}

export async function resolveShareLink(input: string, fetchFn: typeof fetch = fetch): Promise<ResolveResult> {
  try {
    const raw = extractUrl(input ?? '');
    if (!raw) return { kind: 'unknown' };

    const videoId = parseYouTubeUrl(raw);
    if (videoId) return { kind: 'youtube', videoId };

    const url = checkUrl(raw);
    if (!url) return { kind: 'unknown' };
    const host = url.hostname.toLowerCase();

    if (isSpotifyHost(host)) return await resolveSpotify(url, fetchFn);
    if (isAppleHost(host)) return await resolveApple(url, fetchFn);
    if (isDeezerHost(host)) return await resolveDeezer(url, fetchFn);
    if (isSoundCloudHost(host)) return await resolveSoundCloud(url, fetchFn);
    return await resolveGeneric(url, fetchFn);
  } catch {
    return { kind: 'unknown' };
  }
}
