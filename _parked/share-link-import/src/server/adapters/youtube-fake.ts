// Design Ref: §1.2 "Fake adapters for tests" — deterministic YouTube for tests and keyless local runs (YOUTUBE_FAKE=1).
import type { VideoInfo, VideoMatch } from '@/domain/types';
import type { YouTubeClient } from './youtube-api';

const base = (videoId: string, title: string, o: Partial<VideoInfo> = {}): VideoInfo => ({
  videoId,
  title,
  channel: 'Fake Channel',
  thumbUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  durationSec: 30,
  privacyStatus: 'public',
  embeddable: true,
  liveBroadcastContent: 'none',
  regionBlocked: null,
  regionAllowed: null,
  ...o,
});

/** Known fake IDs. Any other well-formed ID that starts with "ok" is treated as a normal public video. */
export const FAKE_VIDEOS: Record<string, VideoInfo> = {
  dQw4w9WgXcQ: base('dQw4w9WgXcQ', 'Never Gonna Give You Up'),
  okSong00001: base('okSong00001', 'Fake Song One'),
  okSong00002: base('okSong00002', 'Fake Song Two'),
  okSong00003: base('okSong00003', 'Fake Song Three'),
  private0001: base('private0001', 'Private', { privacyStatus: 'private' }),
  noEmbed0001: base('noEmbed0001', 'No Embed', { embeddable: false }),
  krBlocked01: base('krBlocked01', 'Blocked in KR', { regionBlocked: ['KR'] }),
  liveNow0001: base('liveNow0001', 'Lofi Radio (live)', { liveBroadcastContent: 'live' }),
};

export const fakeYouTube: YouTubeClient = {
  async getVideos(ids) {
    const out = new Map<string, VideoInfo>();
    for (const id of ids) {
      const v = FAKE_VIDEOS[id] ?? (id.startsWith('ok') ? base(id, `Fake ${id}`) : undefined);
      if (v) out.set(id, v);
    }
    return out;
  },
  async search(query) {
    const q = query.slice(0, 20);
    const make = (n: number): VideoMatch => {
      const id = `ok${String(n).padStart(9, '0')}`.slice(0, 11);
      return { videoId: id, title: `${q} (match ${n})`, channel: 'Fake Channel', thumbUrl: '', durationSec: 200 };
    };
    return [make(1), make(2), make(3)];
  },
};
