import { describe, expect, it } from 'vitest';
import { parseYouTubeUrl, youtubeQueueLinks } from '@/domain/youtube-url';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeUrl (U1)', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&si=abc`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=xyz`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `youtube.com/watch?v=${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('reads %s', (link) => {
    expect(parseYouTubeUrl(link)).toBe(ID);
  });

  it.each([
    '',
    'hello',
    'https://open.spotify.com/track/abc',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ1',
    'https://www.youtube.com/@channel',
    'https://www.youtube.com/playlist?list=PL123',
    'https://evil.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
  ])('rejects %s', (link) => {
    expect(parseYouTubeUrl(link)).toBeNull();
  });
});

import { parseYouTubeChannelLive } from '@/domain/youtube-url';

describe('parseYouTubeChannelLive', () => {
  it.each([
    ['https://www.youtube.com/@LofiGirl', 'https://www.youtube.com/@LofiGirl/live'],
    ['youtube.com/@LofiGirl/live', 'https://www.youtube.com/@LofiGirl/live'],
    ['https://m.youtube.com/@LofiGirl/streams', 'https://www.youtube.com/@LofiGirl/live'],
    ['https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live', 'https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live'],
  ])('%s', (input, out) => expect(parseYouTubeChannelLive(input)).toBe(out));
  it.each(['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.com/@x/live', 'https://www.youtube.com/@a/videos'])(
    'rejects %s',
    (input) => expect(parseYouTubeChannelLive(input)).toBeNull(),
  );
});

describe('youtubeQueueLinks (open the party in YouTube)', () => {
  const id = (n: number) => `song${String(n).padStart(7, '0')}`;
  it('keeps the order, drops repeats and bad ids', () => {
    const [l] = youtubeQueueLinks([id(2), id(1), id(2), 'bad']);
    expect(l.url).toBe(`https://www.youtube.com/watch_videos?video_ids=${id(2)},${id(1)}`);
    expect([l.from, l.to]).toEqual([1, 2]);
  });
  it('splits into links of 50', () => {
    const links = youtubeQueueLinks(Array.from({ length: 120 }, (_, i) => id(i)));
    expect(links.map((l) => [l.from, l.to])).toEqual([[1, 50], [51, 100], [101, 120]]);
    expect(links[1].url.split('=')[1].split(',')).toHaveLength(50);
  });
  it('no songs, no links', () => expect(youtubeQueueLinks([])).toEqual([]));
});
