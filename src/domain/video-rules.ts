// Design Ref: §4.2 check rules 1–5 — decide if a video may join the queue.
// Plan SC: "A fake, private, deleted, non-embeddable, or Korea-blocked link is refused with a plain reason."
import type { ErrorCode } from './messages';
import type { VideoInfo } from './types';

export type RuleResult = { ok: true } | { ok: false; code: ErrorCode };

export function checkQueueable(video: VideoInfo | null, region: string): RuleResult {
  if (!video) return { ok: false, code: 'VIDEO_NOT_FOUND' };
  if (video.privacyStatus === 'private') return { ok: false, code: 'VIDEO_PRIVATE' };
  if (!video.embeddable) return { ok: false, code: 'NOT_EMBEDDABLE' };
  if (isRegionBlocked(video, region)) return { ok: false, code: 'REGION_BLOCKED' };
  if (video.liveBroadcastContent !== 'none') return { ok: false, code: 'LIVE_NOT_QUEUEABLE' };
  return { ok: true };
}

/** For the host's live-stream filler (FR-08): must be live right now and embeddable. */
export function checkLiveFiller(video: VideoInfo | null, region: string): RuleResult {
  if (!video || video.privacyStatus === 'private') return { ok: false, code: 'VIDEO_NOT_FOUND' };
  if (video.liveBroadcastContent !== 'live') return { ok: false, code: 'NOT_LIVE' };
  if (!video.embeddable) return { ok: false, code: 'NOT_EMBEDDABLE' };
  if (isRegionBlocked(video, region)) return { ok: false, code: 'REGION_BLOCKED' };
  return { ok: true };
}

export function isRegionBlocked(video: VideoInfo, region: string): boolean {
  const r = region.toUpperCase();
  if (video.regionBlocked?.map((c) => c.toUpperCase()).includes(r)) return true;
  if (video.regionAllowed && !video.regionAllowed.map((c) => c.toUpperCase()).includes(r)) return true;
  return false;
}
