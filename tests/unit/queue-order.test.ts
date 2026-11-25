import { describe, expect, it } from 'vitest';
import { forwardTrack, nextTrack, previousTrack, reorderPatches, shuffleOrder, upcomingOrder } from '@/domain/queue-order';
import type { Track } from '@/domain/types';

let n = 0;
function t(id: string, o: Partial<Track> = {}): Track {
  n += 1;
  return {
    id,
    eventId: 'e',
    videoId: `vid${id}`.padEnd(11, 'x'),
    title: id,
    channel: 'c',
    thumbUrl: '',
    durationSec: 100,
    addedBy: 'g',
    sourceUrl: null,
    addedAt: `2026-11-26T10:00:${String(n).padStart(2, '0')}Z`,
    firstPlayedAt: null,
    lastPlayedAt: null,
    position: null,
    status: 'ok',
    ytItemId: null,
    syncStatus: 'pending',
    ...o,
  };
}
const played = (at: string) => ({ firstPlayedAt: at, lastPlayedAt: at });

describe('nextTrack (U3)', () => {
  it('empty → idle', () => expect(nextTrack([], null, 'loop', null)).toEqual({ mode: 'idle' }));

  it('never-played first, oldest first', () => {
    const a = t('a', played('2026-11-26T11:00:00Z'));
    const b = t('b');
    const c = t('c');
    expect(nextTrack([c, a, b], 'a', 'loop', null)).toEqual({ mode: 'song', trackId: 'b' });
  });

  it('new song jumps ahead after a full loop', () => {
    const a = t('a', played('2026-11-26T11:00:00Z'));
    const b = t('b', played('2026-11-26T11:03:00Z'));
    const c = t('c', played('2026-11-26T11:06:00Z'));
    const sofia = t('sofia');
    expect(nextTrack([a, b, c, sofia], 'a', 'loop', null)).toEqual({ mode: 'song', trackId: 'sofia' });
  });

  it('loop wraps to the first song', () => {
    const a = t('a', played('1'));
    const b = t('b', played('2'));
    expect(nextTrack([a, b], 'b', 'loop', null)).toEqual({ mode: 'song', trackId: 'a' });
    expect(nextTrack([a, b], 'a', 'loop', null)).toEqual({ mode: 'song', trackId: 'b' });
  });

  it('single song loops on itself', () => {
    const a = t('a', played('1'));
    expect(nextTrack([a], 'a', 'loop', null)).toEqual({ mode: 'song', trackId: 'a' });
  });

  it('stop mode → stopped when all played', () => {
    const a = t('a', played('1'));
    expect(nextTrack([a], 'a', 'stop', null)).toEqual({ mode: 'stopped' });
  });

  it('live mode → live when all played', () => {
    const a = t('a', played('1'));
    expect(nextTrack([a], 'a', 'live', 'LIVEvideo01')).toEqual({ mode: 'live' });
  });

  it('live mode without a stream behaves as loop', () => {
    const a = t('a', played('1'));
    const b = t('b', played('2'));
    expect(nextTrack([a, b], 'a', 'live', null)).toEqual({ mode: 'song', trackId: 'b' });
  });

  it('skips broken songs', () => {
    const a = t('a', played('1'));
    const b = t('b', { status: 'broken' });
    const c = t('c', played('2'));
    expect(nextTrack([a, b, c], 'a', 'loop', null)).toEqual({ mode: 'song', trackId: 'c' });
  });

  it('current removed → continues after its slot', () => {
    const a = t('a', played('1'));
    const gone = t('gone', played('2'));
    const c = t('c', played('3'));
    // `gone` is current but no longer in the list
    expect(nextTrack([a, c], 'gone', 'loop', null)).toEqual({ mode: 'song', trackId: 'a' });
    expect(nextTrack([a, gone, c].filter((x) => x.id !== 'gone'), null, 'loop', null)).toEqual({
      mode: 'song',
      trackId: 'a',
    });
  });

  it('nothing playing yet → oldest never-played', () => {
    const a = t('a');
    const b = t('b');
    expect(nextTrack([b, a], null, 'loop', null)).toEqual({ mode: 'song', trackId: 'a' });
  });
});

describe('previousTrack (U4)', () => {
  it('returns the latest played before current', () => {
    const a = t('a', played('2026-11-26T11:00:00Z'));
    const b = t('b', played('2026-11-26T11:03:00Z'));
    const c = t('c', played('2026-11-26T11:06:00Z'));
    expect(previousTrack([a, b, c], 'c')).toBe('b');
  });
  it('nothing before → restart current', () => {
    const a = t('a', played('2026-11-26T11:00:00Z'));
    expect(previousTrack([a], 'a')).toBe('a');
  });
});

describe('upcomingOrder', () => {
  it('fresh first, then loop order after current', () => {
    const a = t('a', played('1'));
    const b = t('b', played('2'));
    const c = t('c', played('3'));
    const d = t('d');
    b.lastPlayedAt = '2026-11-26T12:00:00Z'; // the current song is the newest one played
    expect(upcomingOrder([a, b, c, d], 'b').map((x) => x.id)).toEqual(['d', 'c', 'a']);
  });
});

describe('reorderPatches (host reorder)', () => {
  // Apply the patches the way the server does, then read the queue back
  const apply = (tracks: Track[], currentId: string | null, ids: string[]) => {
    const patches = new Map(reorderPatches(tracks, currentId, ids).map((p) => [p.id, p]));
    return tracks.map((x) => {
      if (x.id === currentId) return { ...x, lastPlayedAt: '2026-11-26T12:00:00Z' }; // the server does this too
      const p = patches.get(x.id);
      return p ? { ...x, position: p.position, ...(p.markUnplayed ? { firstPlayedAt: null } : {}) } : x;
    });
  };
  const ids = (xs: Track[]) => xs.map((x) => x.id);

  it('reorders never-played songs, and the next song follows the new order', () => {
    const a = t('a');
    const b = t('b');
    const c = t('c');
    const after = apply([a, b, c], null, ['c', 'a', 'b']);
    expect(ids(upcomingOrder(after, null))).toEqual(['c', 'a', 'b']);
    expect(nextTrack(after, null, 'loop', null)).toEqual({ mode: 'song', trackId: 'c' });
  });

  it('reorders the loop after the current song', () => {
    const a = t('a', played('1'));
    const b = t('b', played('2'));
    const c = t('c', played('3'));
    const d = t('d', played('4'));
    const after = apply([a, b, c, d], 'b', ['a', 'd', 'c']);
    expect(ids(upcomingOrder(after, 'b'))).toEqual(['a', 'd', 'c']);
    expect(nextTrack(after, 'b', 'loop', null)).toEqual({ mode: 'song', trackId: 'a' });
  });

  it('a played song moved above a new song plays first', () => {
    const a = t('a', played('1'));
    const b = t('b', played('2'));
    const n1 = t('n1');
    const after = apply([a, b, n1], 'b', ['a', 'n1']);
    expect(ids(upcomingOrder(after, 'b'))).toEqual(['a', 'n1']);
    expect(nextTrack(after, 'b', 'loop', null)).toEqual({ mode: 'song', trackId: 'a' });
  });

  it('a new song moved below played songs keeps that place', () => {
    const a = t('a', played('1'));
    const b = t('b', played('2'));
    const c = t('c', played('3'));
    const n1 = t('n1');
    const after = apply([a, b, c, n1], 'a', ['b', 'c', 'n1']);
    expect(ids(upcomingOrder(after, 'a'))).toEqual(['b', 'c', 'n1']);
  });

  it('a song added after the reorder goes last', () => {
    const a = t('a');
    const b = t('b');
    const after = apply([a, b], null, ['b', 'a']);
    const late = t('late');
    expect(ids(upcomingOrder([...after, late], null))).toEqual(['b', 'a', 'late']);
  });

  it('ignores unknown ids and the current song', () => {
    const a = t('a', played('1'));
    const b = t('b');
    expect(reorderPatches([a, b], 'a', ['zzz', 'a', 'b']).map((p) => p.id)).toEqual(['b']);
  });
});

describe('previous and next through history', () => {
  const a = t('a', played('2026-11-26T11:00:00Z'));
  const b = t('b', played('2026-11-26T11:03:00Z'));
  const c = t('c', played('2026-11-26T11:06:00Z'));
  const list = [a, b, c, t('new')];

  it('pressing Previous twice goes back two songs (no ping-pong)', () => {
    const first = previousTrack(list, 'c');
    expect(first).toBe('b');
    expect(previousTrack(list, first)).toBe('a');
  });
  it('Next after Previous goes forward through the same songs', () => {
    expect(forwardTrack(list, 'a')).toBe('b');
    expect(forwardTrack(list, 'b')).toBe('c');
  });
  it('Up Next shows the songs that Next will really play', () => {
    expect(upcomingOrder(list, 'a').map((x) => x.id)).toEqual(['b', 'c', 'new']);
  });
  it('at the newest song there is nothing to go forward to', () => {
    expect(forwardTrack(list, 'c')).toBeNull();
    expect(forwardTrack(list, null)).toBeNull();
  });
  it('skips broken songs', () => {
    expect(forwardTrack([a, { ...b, status: 'broken' as const }, c], 'a')).toBe('c');
  });
  it('reads database times with different digit counts', () => {
    const x = t('x', played('2026-11-26T11:00:00.48+00:00'));
    const y = t('y', played('2026-11-26T11:00:00.484067+00:00'));
    expect(forwardTrack([x, y], 'x')).toBe('y');
  });
});

describe('shuffleOrder', () => {
  const list = [t('n1'), t('n2'), t('n3'), t('p1', played('1')), t('p2', played('2'))];

  it('keeps every song once, never-played songs first, and changes the order', () => {
    for (let n = 0; n < 50; n++) {
      const ids = shuffleOrder(list);
      expect([...ids].sort()).toEqual(['n1', 'n2', 'n3', 'p1', 'p2']);
      expect(ids.slice(0, 3).every((id) => id.startsWith('n'))).toBe(true);
    }
    const two = [t('n1'), t('n2')];
    let first = true;
    expect(shuffleOrder(two, () => (first ? ((first = false), 0.9) : 0)).join()).toBe('n2,n1');
  });
  it('the saved shuffle is the order that plays', () => {
    const ids = shuffleOrder(list);
    const patches = new Map(reorderPatches(list, null, ids).map((p) => [p.id, p]));
    const after = list.map((x) => ({ ...x, position: patches.get(x.id)!.position }));
    expect(upcomingOrder(after, null).map((x) => x.id)).toEqual(ids);
  });
  it('an empty list stays empty', () => expect(shuffleOrder([])).toEqual([]));
});
