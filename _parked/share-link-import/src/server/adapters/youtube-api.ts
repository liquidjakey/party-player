// Design Ref: §4.2 — YouTube Data API v3 client (key-based reads). Swapped for a fake when YOUTUBE_FAKE=1.
import 'server-only';
import { AppError } from '@/domain/errors';
import type { VideoInfo, VideoMatch } from '@/domain/types';
import { COST, spendQuota } from './quota';
import { fakeYouTube } from './youtube-fake';

export interface YouTubeClient {
  getVideos(ids: string[]): Promise<Map<string, VideoInfo>>;
  search(query: string, region: string): Promise<VideoMatch[]>;
}

const API = 'https://www.googleapis.com/youtube/v3';

/** ISO 8601 duration (PT1H2M3S) → seconds. */
export function parseDuration(iso: string | undefined): number {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

async function call(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('Missing YOUTUBE_API_KEY');
  const qs = new URLSearchParams({ ...params, key });
  let res: Response;
  try {
    res = await fetch(`${API}/${path}?${qs}`, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
  } catch {
    throw new AppError('YOUTUBE_UNAVAILABLE');
  }
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: { errors?: { reason?: string }[] } };
    const reason = body.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new AppError('QUOTA_EXCEEDED');
    throw new AppError('YOUTUBE_UNAVAILABLE');
  }
  if (!res.ok) throw new AppError('YOUTUBE_UNAVAILABLE');
  return (await res.json()) as Record<string, unknown>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toVideoInfo(item: any): VideoInfo {
  const thumbs = item.snippet?.thumbnails ?? {};
  return {
    videoId: item.id,
    title: item.snippet?.title ?? '',
    channel: item.snippet?.channelTitle ?? '',
    thumbUrl: (thumbs.medium ?? thumbs.high ?? thumbs.default)?.url ?? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
    durationSec: parseDuration(item.contentDetails?.duration),
    privacyStatus: item.status?.privacyStatus ?? 'public',
    embeddable: item.status?.embeddable !== false,
    liveBroadcastContent: item.snippet?.liveBroadcastContent ?? 'none',
    regionBlocked: item.contentDetails?.regionRestriction?.blocked ?? null,
    regionAllowed: item.contentDetails?.regionRestriction?.allowed ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const realYouTube: YouTubeClient = {
  async getVideos(ids) {
    const out = new Map<string, VideoInfo>();
    if (ids.length === 0) return out;
    if (!(await spendQuota(COST.videosList))) throw new AppError('QUOTA_EXCEEDED');
    const data = await call('videos', { part: 'snippet,status,contentDetails', id: ids.slice(0, 50).join(',') });
    for (const item of (data.items as unknown[]) ?? []) {
      const v = toVideoInfo(item);
      out.set(v.videoId, v);
    }
    return out;
  },

  async search(query, region) {
    if (!(await spendQuota(COST.searchList + COST.videosList))) throw new AppError('QUOTA_EXCEEDED');
    const data = await call('search', {
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      regionCode: region,
      maxResults: '5',
      q: query,
    });
    const ids = ((data.items as { id?: { videoId?: string } }[]) ?? [])
      .map((i) => i.id?.videoId)
      .filter((x): x is string => !!x);
    if (ids.length === 0) return [];
    const details = await call('videos', { part: 'snippet,status,contentDetails', id: ids.join(',') });
    return ((details.items as unknown[]) ?? []).map(toVideoInfo).map(({ videoId, title, channel, thumbUrl, durationSec }) => ({
      videoId,
      title,
      channel,
      thumbUrl,
      durationSec,
    }));
  },
};

export function youtube(): YouTubeClient {
  return process.env.YOUTUBE_FAKE === '1' ? fakeYouTube : realYouTube;
}
