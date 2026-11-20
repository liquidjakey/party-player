import { describe, expect, it } from 'vitest';
import { nextTrack, previousTrack, upcomingOrder } from '@/domain/queue-order';
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
    expect(upcomingOrder([a, b, c, d], 'b').map((x) => x.id)).toEqual(['d', 'c', 'a']);
  });
});
