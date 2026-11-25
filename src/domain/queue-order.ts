// Design Ref: §4.3 — song order. Pure functions; the server calls these, the TV never decides.
import type { EndMode, Track } from './types';

export type NextResult =
  | { mode: 'song'; trackId: string }
  | { mode: 'live' }
  | { mode: 'stopped' }
  | { mode: 'idle' };

/** Queue key: the host's saved position, else the time the song was added. New songs go last. */
export const keyOf = (t: Track) => t.position ?? Date.parse(t.addedAt);
const byAdded = (a: Track, b: Track) => keyOf(a) - keyOf(b) || a.id.localeCompare(b.id);

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

/**
 * Next after Back: the song played right after the current one. Back keeps play times as they were,
 * so a song with a later time than the current one exists only when someone went back.
 */
export function forwardTrack(tracks: Track[], currentId: string | null): string | null {
  return forwardTracks(tracks, currentId)[0]?.id ?? null;
}

function forwardTracks(tracks: Track[], currentId: string | null): Track[] {
  const current = currentId ? tracks.find((t) => t.id === currentId) : undefined;
  if (!current?.lastPlayedAt) return [];
  const at = (t: Track) => Date.parse(t.lastPlayedAt as string);
  return tracks
    .filter((t) => t.status === 'ok' && t.id !== current.id && t.lastPlayedAt !== null && at(t) > at(current))
    .sort((a, b) => at(a) - at(b));
}

/** Shuffle the upcoming songs. Never-played songs stay ahead of played ones, so everyone's song still gets its turn. */
export function shuffleOrder(upcoming: Track[], rand: () => number = Math.random): string[] {
  const mix = (xs: Track[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const fresh = upcoming.filter((t) => t.firstPlayedAt === null);
  const played = upcoming.filter((t) => t.firstPlayedAt !== null);
  const before = upcoming.map((t) => t.id).join();
  let ids: string[] = [];
  // A short list can land on the same order; try again so the press always does something
  for (let n = 0; n < 8; n++) {
    ids = [...mix(fresh), ...mix(played)].map((t) => t.id);
    if (ids.join() !== before) break;
  }
  return ids;
}

/** The queue as guests see it: songs stepped back over, then never-played songs (oldest first), then the loop order after current. */
export function upcomingOrder(tracks: Track[], currentId: string | null): Track[] {
  const forward = forwardTracks(tracks, currentId);
  const ok = tracks.filter((t) => t.id !== currentId && !forward.includes(t)).sort(byAdded);
  const fresh = ok.filter((t) => t.firstPlayedAt === null);
  const played = ok.filter((t) => t.firstPlayedAt !== null);
  const current = currentId ? tracks.find((t) => t.id === currentId) : undefined;
  const pivot = current ? played.findIndex((t) => byAdded(t, current) > 0) : 0;
  const rotated = pivot > 0 ? [...played.slice(pivot), ...played.slice(0, pivot)] : played;
  return [...forward, ...fresh, ...rotated];
}

export interface ReorderPatch {
  id: string;
  position: number;
  /** true = mark as never played, so it keeps its new place ahead of songs below it */
  markUnplayed: boolean;
}

/**
 * The host drags the queue into `orderedIds` (the upcoming list, current song left out).
 * Returns the writes that make `upcomingOrder` show exactly that order.
 * - Each song gets a key just after the current song's key, in the new order, so the loop rotation starts with it.
 * - Never-played songs always go first. So every song above the lowest never-played song is marked never played too.
 */
export function reorderPatches(tracks: Track[], currentId: string | null, orderedIds: string[]): ReorderPatch[] {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const list = [...new Set(orderedIds)].filter((id) => id !== currentId && byId.has(id)).map((id) => byId.get(id)!);
  const current = currentId ? byId.get(currentId) : undefined;
  const base = current ? keyOf(current) : 0;
  let lastFresh = -1;
  list.forEach((t, i) => {
    if (t.firstPlayedAt === null) lastFresh = i;
  });
  return list.map((t, i) => ({ id: t.id, position: base + i + 1, markUnplayed: i <= lastFresh && t.firstPlayedAt !== null }));
}
