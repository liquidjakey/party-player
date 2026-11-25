'use client';
import { useEffect, useState } from 'react';
import { CheckIcon, WarningIcon } from './Icons';

export interface ToastMsg {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

/**
 * Translucent capsule above the bottom edge. Arrives and leaves along the same path.
 * Up to two lines; errors stay 5 s, confirmations 3 s.
 */
export function Toast({ msg, onDone }: { msg: ToastMsg | null; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [shownId, setShownId] = useState<number | null>(null);
  if (msg && msg.id !== shownId) {
    setShownId(msg.id);
    setLeaving(false);
  }
  useEffect(() => {
    if (!msg) return;
    const out = setTimeout(() => setLeaving(true), msg.kind === 'error' ? 5000 : 3000);
    const gone = setTimeout(onDone, (msg.kind === 'error' ? 5000 : 3000) + 250);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [msg, onDone]);
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div
        key={msg.id}
        role={msg.kind === 'error' ? 'alert' : 'status'}
        aria-live={msg.kind === 'error' ? 'assertive' : 'polite'}
        className={`material flex max-w-md items-center gap-2 rounded-2xl px-4 py-2.5 text-[0.9375rem] font-semibold shadow-[var(--shadow)] ring-1 ring-[var(--material-edge)] ${
          leaving ? 'dematerialize' : 'materialize'
        }`}
      >
        {msg.kind === 'ok' ? <CheckIcon className="flex-none text-ok" /> : <WarningIcon className="flex-none text-danger" />}
        <span className="line-clamp-2">{msg.text}</span>
      </div>
    </div>
  );
}
