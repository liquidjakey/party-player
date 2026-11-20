// Design Ref: §4.3 — song order. Pure functions; the server calls these, the TV never decides.
import type { EndMode, Track } from './types';

export type NextResult =
  | { mode: 'song'; trackId: string }
  | { mode: 'live' }
  | { mode: 'stopped' }
  | { mode: 'idle' };

const byAdded = (a: Track, b: Track) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id);

/**
 * Pick what plays after `currentId`.
 * Plan SC (FR-06): songs that never played go first, oldest first.
 */
export function nextTrack(
  tracks: Track[],
  currentId: string | null,
  endMode: EndMode,
  liveVideoId: string | null,
): NextResult {
  const ok = tracks.filter((t) => t.status === 'ok').sort(byAdded);
  if (ok.length === 0) return { mode: 'idle' };

  const neverPlayed = ok.find((t) => t.firstPlayedAt === null && t.id !== currentId);
  if (neverPlayed) return { mode: 'song', trackId: neverPlayed.id };

  if (endMode === 'stop') return { mode: 'stopped' };
  if (endMode === 'live' && liveVideoId) return { mode: 'live' };

  // Loop: the song after the current one in added order, wrapping around.
  const idx = currentId ? ok.findIndex((t) => t.id === currentId) : -1;
  if (idx === -1) {
    // Current is gone (removed/broken) or nothing was playing: start from the
    // first song added after the current one's slot, else the first song.
    const current = currentId ? tracks.find((t) => t.id === currentId) : undefined;
    const after = current ? ok.find((t) => byAdded(t, current) > 0) : undefined;
    return { mode: 'song', trackId: (after ?? ok[0]).id };
  }
  return { mode: 'song', trackId: ok[(idx + 1) % ok.length].id };
}

/** Back: the song played most recently before the current one; none → restart current. */
export function previousTrack(tracks: Track[], currentId: string | null): string | null {
  const current = currentId ? tracks.find((t) => t.id === currentId) : undefined;
  const cutoff = current?.lastPlayedAt ?? null;
  const candidates = tracks
    .filter((t) => t.status === 'ok' && t.id !== currentId && t.lastPlayedAt !== null)
    .filter((t) => cutoff === null || (t.lastPlayedAt as string) < cutoff)
    .sort((a, b) => (b.lastPlayedAt as string).localeCompare(a.lastPlayedAt as string));
  return candidates[0]?.id ?? currentId;
}

/** The queue as guests see it: never-played songs first (oldest first), then the loop order after current. */
export function upcomingOrder(tracks: Track[], currentId: string | null): Track[] {
  const ok = tracks.filter((t) => t.id !== currentId).sort(byAdded);
  const fresh = ok.filter((t) => t.firstPlayedAt === null);
  const played = ok.filter((t) => t.firstPlayedAt !== null);
  const current = currentId ? tracks.find((t) => t.id === currentId) : undefined;
  const pivot = current ? played.findIndex((t) => byAdded(t, current) > 0) : 0;
  const rotated = pivot > 0 ? [...played.slice(pivot), ...played.slice(0, pivot)] : played;
  return [...fresh, ...rotated];
}
