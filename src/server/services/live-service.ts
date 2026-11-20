// Design Ref: §4.2 PATCH settings liveUrl + FR-08 — find and check the live-stream filler.
import 'server-only';
import { AppError } from '@/domain/errors';
import type { PartyEvent } from '@/domain/types';
import { checkLiveFiller } from '@/domain/video-rules';
import { isVideoId, parseYouTubeChannelLive, parseYouTubeUrl } from '@/domain/youtube-url';
import { youtube } from '../adapters/youtube-api';
import { safeFetch } from '../adapters/safe-fetch';

/** Read a channel's /live page: the canonical link points to the stream that is live now. Free (no API quota). */
export async function currentLiveFromChannel(liveSource: string): Promise<string | null> {
  if (process.env.YOUTUBE_FAKE === '1') return 'liveNow0001';
  const page = await safeFetch(liveSource, fetch, { headers: { Cookie: 'CONSENT=YES+1' } });
  if (!page) return null;
  const m = page.body.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/);
  if (!m || !/"isLiveNow":true/.test(page.body)) return null;
  return isVideoId(m[1]) ? m[1] : null;
}

export interface LiveFiller {
  liveVideoId: string;
  liveSource: string | null;
  title: string;
}

/** Accept a live video link, or a channel link (@handle, /channel/UC…). Throws NOT_LIVE / NOT_EMBEDDABLE. */
export async function resolveLiveFiller(input: string, region: string): Promise<LiveFiller> {
  const liveSource = parseYouTubeChannelLive(input);
  const videoId = liveSource ? await currentLiveFromChannel(liveSource) : parseYouTubeUrl(input);
  if (!videoId) throw new AppError(liveSource ? 'NOT_LIVE' : 'INVALID_LINK');
  const video = (await youtube().getVideos([videoId])).get(videoId) ?? null;
  const rule = checkLiveFiller(video, region);
  if (!rule.ok) throw new AppError(rule.code);
  return { liveVideoId: videoId, liveSource, title: video!.title };
}

/** Before switching to live: make sure the stream is still on (re-find it from the channel if needed). */
export async function refreshLiveFiller(event: PartyEvent): Promise<string | null> {
  try {
    if (event.liveSource) return (await resolveLiveFiller(event.liveSource, event.region)).liveVideoId;
    if (event.liveVideoId) return (await resolveLiveFiller(event.liveVideoId, event.region)).liveVideoId;
  } catch {
    /* not live any more */
  }
  return null;
}
