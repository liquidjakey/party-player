'use client';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/client/api';
import { BackwardIcon, CheckIcon, ForwardIcon, PauseIcon, PlayIcon, ShuffleIcon } from './Icons';

export type ControlAction = 'play' | 'pause' | 'skip' | 'back' | 'shuffle';

/**
 * FR-10 — playback buttons: shuffle, previous, play/pause, next. Used by the host remote and the TV page.
 * Play/Pause flips instantly (optimistic) and rolls back if the server says no. Repeat taps are ignored while a
 * command is in flight, without dimming the buttons. Left/right arrow keys move between buttons (TV remotes).
 */
export function HostControls({
  send: sendAction,
  isPlaying,
  size = 'md',
  onError,
}: {
  send: (action: ControlAction) => Promise<unknown>;
  isPlaying: boolean;
  size?: 'md' | 'lg';
  onError?: (msg: string) => void;
}) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [seen, setSeen] = useState(isPlaying);
  if (isPlaying !== seen) {
    setSeen(isPlaying);
    setPending(null); // the server caught up
  }
  const [shuffled, setShuffled] = useState(false);
  useEffect(() => {
    if (!shuffled) return;
    const t = setTimeout(() => setShuffled(false), 1600);
    return () => clearTimeout(t);
  }, [shuffled]);
  const inFlight = useRef(false);
  const group = useRef<HTMLDivElement>(null);
  const shown = pending ?? isPlaying;
  const big = size === 'lg';

  async function send(action: ControlAction) {
    if (inFlight.current) return;
    inFlight.current = true;
    if (action === 'play' || action === 'pause') setPending(action === 'play');
    try {
      await sendAction(action);
      if (action === 'shuffle') setShuffled(true);
    } catch (e) {
      setPending(null);
      onError?.(e instanceof ApiError ? e.message : 'Something broke. Try again');
    } finally {
      inFlight.current = false;
    }
  }

  function moveFocus(e: React.KeyboardEvent) {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!step) return;
    const buttons = [...(group.current?.querySelectorAll('button') ?? [])];
    const next = buttons[buttons.indexOf(document.activeElement as HTMLButtonElement) + step];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  const side = `press grid flex-none place-items-center rounded-full ${big ? 'h-20 w-20 text-4xl' : 'h-14 w-14 text-[1.75rem]'}`;
  return (
    <div ref={group} onKeyDown={moveFocus} className={`flex items-center justify-center ${big ? 'gap-5' : 'gap-4'}`} role="group" aria-label="Playback controls">
      <button type="button" aria-label="Shuffle the songs up next" onClick={() => send('shuffle')} className={`${side} ${big ? '' : 'text-[1.5rem]!'}`}>
        {shuffled ? <CheckIcon className="materialize" /> : <ShuffleIcon />}
      </button>
      <button type="button" aria-label="Previous song" onClick={() => send('back')} className={side}>
        <BackwardIcon />
      </button>
      <button
        type="button"
        autoFocus={big}
        aria-label={shown ? 'Pause' : 'Play'}
        onClick={() => send(shown ? 'pause' : 'play')}
        className={`press btn-primary grid flex-none place-items-center rounded-full ${big ? 'h-24 w-24 text-5xl' : 'h-[4.5rem] w-[4.5rem] text-[2.125rem]'}`}
      >
        {shown ? <PauseIcon /> : <PlayIcon className="translate-x-[2px]" />}
      </button>
      <button type="button" aria-label="Next song" onClick={() => send('skip')} className={side}>
        <ForwardIcon />
      </button>
      {/* Keeps Play in the middle on the phone */}
      {!big && <span aria-hidden className="w-14 flex-none" />}
      <span role="status" className="sr-only">
        {shuffled ? 'Shuffled' : ''}
      </span>
    </div>
  );
}
