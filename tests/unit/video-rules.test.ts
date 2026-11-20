import { describe, expect, it } from 'vitest';
import { checkLiveFiller, checkQueueable } from '@/domain/video-rules';
import type { VideoInfo } from '@/domain/types';

const base: VideoInfo = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Song',
  channel: 'Artist',
  thumbUrl: 'https://i.ytimg.com/x.jpg',
  durationSec: 200,
  privacyStatus: 'public',
  embeddable: true,
  liveBroadcastContent: 'none',
  regionBlocked: null,
  regionAllowed: null,
};
const v = (o: Partial<VideoInfo>): VideoInfo => ({ ...base, ...o });

describe('checkQueueable (U2)', () => {
  it('accepts a public, embeddable video', () => expect(checkQueueable(base, 'KR')).toEqual({ ok: true }));
  it('accepts unlisted', () => expect(checkQueueable(v({ privacyStatus: 'unlisted' }), 'KR').ok).toBe(true));
  it('rejects missing', () => expect(checkQueueable(null, 'KR')).toEqual({ ok: false, code: 'VIDEO_NOT_FOUND' }));
  it('rejects private', () =>
    expect(checkQueueable(v({ privacyStatus: 'private' }), 'KR')).toEqual({ ok: false, code: 'VIDEO_PRIVATE' }));
  it('rejects not embeddable', () =>
    expect(checkQueueable(v({ embeddable: false }), 'KR')).toEqual({ ok: false, code: 'NOT_EMBEDDABLE' }));
  it('rejects blocked in region', () =>
    expect(checkQueueable(v({ regionBlocked: ['JP', 'KR'] }), 'KR')).toEqual({ ok: false, code: 'REGION_BLOCKED' }));
  it('accepts blocked elsewhere', () => expect(checkQueueable(v({ regionBlocked: ['JP'] }), 'KR').ok).toBe(true));
  it('rejects allow-list without region', () =>
    expect(checkQueueable(v({ regionAllowed: ['US'] }), 'kr')).toEqual({ ok: false, code: 'REGION_BLOCKED' }));
  it('accepts allow-list with region', () => expect(checkQueueable(v({ regionAllowed: ['US', 'KR'] }), 'KR').ok).toBe(true));
  it('rejects live and upcoming', () => {
    expect(checkQueueable(v({ liveBroadcastContent: 'live' }), 'KR')).toEqual({ ok: false, code: 'LIVE_NOT_QUEUEABLE' });
    expect(checkQueueable(v({ liveBroadcastContent: 'upcoming' }), 'KR').ok).toBe(false);
  });
});

describe('checkLiveFiller', () => {
  it('accepts a live, embeddable stream', () =>
    expect(checkLiveFiller(v({ liveBroadcastContent: 'live' }), 'KR')).toEqual({ ok: true }));
  it('rejects a normal video', () => expect(checkLiveFiller(base, 'KR')).toEqual({ ok: false, code: 'NOT_LIVE' }));
  it('rejects a non-embeddable live', () =>
    expect(checkLiveFiller(v({ liveBroadcastContent: 'live', embeddable: false }), 'KR').ok).toBe(false));
});
