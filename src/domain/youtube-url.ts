// Design Ref: §4.2 FR-03 — read a video ID out of any common YouTube link format.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

/** Returns the 11-char video ID, or null if the text is not a YouTube video link. */
export function parseYouTubeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (YT_HOSTS.has(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') {
      candidate = url.searchParams.get('v');
    } else if (['shorts', 'live', 'embed', 'v', 'e'].includes(parts[0] ?? '')) {
      candidate = parts[1] ?? null;
    }
  }

  return candidate && isVideoId(candidate) ? candidate : null;
}

/**
 * FR-08 live filler: a channel's live page stays valid when the stream restarts.
 * Accepts youtube.com/@handle(/live), youtube.com/channel/UC…(/live). Returns the canonical /live URL or null.
 */
export function parseYouTubeChannelLive(input: string): string | null {
  const text = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!YT_HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const first = parts[0] ?? '';
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(first) && (parts.length === 1 || parts[1] === 'live' || parts[1] === 'streams')) {
    return `https://www.youtube.com/${first}/live`;
  }
  if (first === 'channel' && /^UC[A-Za-z0-9_-]{22}$/.test(parts[1] ?? '')) {
    return `https://www.youtube.com/channel/${parts[1]}/live`;
  }
  return null;
}
