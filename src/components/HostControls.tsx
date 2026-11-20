'use client';
import { useState } from 'react';
import { api, ApiError } from '@/client/api';
import { BackwardIcon, ForwardIcon, PauseIcon, PlayIcon } from './Icons';

/** FR-10 — transport controls (Back / Play-Pause / Skip). Host only; the server checks the cookie. */
export function HostControls({
  slug,
  isPlaying,
  size = 'md',
  onError,
}: {
  slug: string;
  isPlaying: boolean;
  size?: 'md' | 'lg';
  onError?: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function send(action: 'play' | 'pause' | 'skip' | 'back') {
    setBusy(true);
    try {
      await api(`/api/e/${slug}/host/control`, { body: { action } });
    } catch (e) {
      onError?.(e instanceof ApiError ? e.message : 'Something broke.');
    } finally {
      setBusy(false);
    }
  }
  const big = size === 'lg';
  const side = `press grid place-items-center rounded-full disabled:opacity-40 ${big ? 'h-20 w-20 text-4xl' : 'h-14 w-14 text-[1.75rem]'}`;
  return (
    <div className={`flex items-center justify-center ${big ? 'gap-8' : 'gap-6'}`} role="group" aria-label="Playback controls">
      <button type="button" disabled={busy} aria-label="Back" onClick={() => send('back')} className={side}>
        <BackwardIcon />
      </button>
      <button
        type="button"
        disabled={busy}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={() => send(isPlaying ? 'pause' : 'play')}
        className={`press btn-primary grid place-items-center rounded-full disabled:opacity-40 ${
          big ? 'h-24 w-24 text-5xl' : 'h-[4.5rem] w-[4.5rem] text-[2.125rem]'
        }`}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon className="translate-x-[2px]" />}
      </button>
      <button type="button" disabled={busy} aria-label="Skip" onClick={() => send('skip')} className={side}>
        <ForwardIcon />
      </button>
    </div>
  );
}
