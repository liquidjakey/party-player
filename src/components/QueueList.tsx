'use client';
import { useState } from 'react';
import type { Track } from '@/domain/types';
import { tintFor } from './Avatar';
import { MinusCircleIcon, WarningIcon } from './Icons';

/**
 * FR-05 — the queue as an inset grouped list. Own songs get the iOS red minus;
 * tapping it reveals a "Remove" button in the row (the server checks ownership again).
 */
export function QueueList({
  tracks,
  nameOf,
  canRemove,
  onRemove,
  firstLabel,
}: {
  tracks: Track[];
  nameOf: (guestId: string | null) => string;
  canRemove: (t: Track) => boolean;
  onRemove: (t: Track) => Promise<void>;
  firstLabel?: string;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (tracks.length === 0) {
    return <p className="card px-4 py-6 text-center text-muted">The queue is empty. Add the first song.</p>;
  }

  return (
    <ol className="group">
      {tracks.map((t, i) => {
        const mine = canRemove(t);
        const open = confirming === t.id;
        return (
          <li key={t.id} className="group-row arrive py-2">
            {mine && (
              <button
                type="button"
                aria-label={open ? 'Cancel' : `Remove ${t.title}`}
                aria-expanded={open}
                onClick={() => setConfirming(open ? null : t.id)}
                className={`press -ml-1 grid h-8 w-8 flex-none place-items-center text-[1.375rem] text-danger transition-transform duration-200 ${
                  open ? 'rotate-90' : ''
                }`}
              >
                <MinusCircleIcon />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.thumbUrl} alt="" className="h-11 w-11 flex-none rounded-lg bg-fill object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-medium">{t.title}</p>
              <p className="t-footnote flex items-center gap-1 truncate text-muted">
                {i === 0 && firstLabel ? <span className="font-semibold text-accent">{firstLabel} · </span> : null}
                <span aria-hidden className={`inline-block h-2 w-2 flex-none rounded-full ${tintFor(nameOf(t.addedBy)).split(' ')[0]}`} />
                {nameOf(t.addedBy)}
                {t.status === 'broken' && (
                  <span className="inline-flex items-center gap-0.5 text-danger">
                    · <WarningIcon /> Couldn&apos;t play
                  </span>
                )}
              </p>
            </div>
            {open && (
              <button
                type="button"
                disabled={busy === t.id}
                onClick={async () => {
                  setBusy(t.id);
                  try {
                    await onRemove(t);
                  } finally {
                    setBusy(null);
                    setConfirming(null);
                  }
                }}
                className="press materialize min-h-9 flex-none rounded-lg bg-danger px-3 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
