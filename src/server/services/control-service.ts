// FR-10 — playback commands, shared by the host remote (host cookie) and the TV page (active player).
import 'server-only';
import type { PartyEvent } from '@/domain/types';
import { advance, back, getPlayerState, setPlaying } from './player-service';
import { shuffleQueue } from './track-service';

export const CONTROL_ACTIONS = ['play', 'pause', 'skip', 'back', 'shuffle'] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export async function control(event: PartyEvent, action: ControlAction): Promise<void> {
  if (action === 'pause') return setPlaying(event.id, false);
  if (action === 'skip') return advance(event);
  if (action === 'back') return back(event);
  if (action === 'shuffle') return shuffleQueue(event.id);
  const { mode } = await getPlayerState(event.id);
  if (mode === 'song' || mode === 'live') return setPlaying(event.id, true);
  // Play after the music stopped = start again from the first song
  return advance(mode === 'stopped' ? { ...event, endMode: 'loop' } : event);
}
