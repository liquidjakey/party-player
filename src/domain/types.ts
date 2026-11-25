// Design Ref: §3.1 — shared entity types. Pure: no imports outside src/domain.

export type EndMode = 'loop' | 'stop' | 'live';
export type PlayerMode = 'song' | 'live' | 'stopped' | 'idle';
export type TrackStatus = 'ok' | 'broken';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'skipped';

export interface PartyEvent {
  id: string;
  slug: string;
  name: string;
  region: string; // ISO 3166-1 alpha-2, default 'KR'
  endMode: EndMode;
  liveVideoId: string | null;
  liveSource: string | null; // channel live page, e.g. https://www.youtube.com/@LofiGirl/live
  ytPlaylistId: string | null;
  notice: string | null; // e.g. 'live_ended'
  createdAt: string;
}

export interface Guest {
  id: string;
  eventId: string;
  name: string;
  color: number | null; // 0–4, fixed when the guest is added (null on old rows)
}

export interface Track {
  id: string;
  eventId: string;
  videoId: string;
  title: string;
  channel: string;
  thumbUrl: string;
  durationSec: number;
  addedBy: string | null; // guest id; null = host
  sourceUrl: string | null;
  addedAt: string;
  firstPlayedAt: string | null; // null = never played (FR-06)
  lastPlayedAt: string | null; // used by Back
  position: number | null; // host-set queue order; null = by added time
  status: TrackStatus;
  ytItemId: string | null;
  syncStatus: SyncStatus;
}

export interface PlayerState {
  eventId: string;
  currentTrackId: string | null;
  mode: PlayerMode;
  isPlaying: boolean;
  positionSec: number;
  activePlayerId: string | null;
  playSeq: number; // +1 each time something new starts; the TV reloads on change
  updatedAt: string;
}

/** Facts about one YouTube video, as returned by the YouTube client (real or fake). */
export interface VideoInfo {
  videoId: string;
  title: string;
  channel: string;
  thumbUrl: string;
  durationSec: number;
  privacyStatus: 'public' | 'unlisted' | 'private';
  embeddable: boolean;
  liveBroadcastContent: 'none' | 'live' | 'upcoming';
  regionBlocked: string[] | null; // contentDetails.regionRestriction.blocked
  regionAllowed: string[] | null; // contentDetails.regionRestriction.allowed
}
