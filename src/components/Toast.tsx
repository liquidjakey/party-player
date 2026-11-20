'use client';
import { useEffect } from 'react';
import { CheckIcon, WarningIcon } from './Icons';

export interface ToastMsg {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

/** Translucent capsule that materializes above the bottom edge. Clears itself after 3 s. */
export function Toast({ msg, onDone }: { msg: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div
        key={msg.id}
        role="status"
        aria-live="polite"
        className="material materialize flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-[0.9375rem] font-semibold shadow-[var(--shadow)] ring-1 ring-[var(--material-edge)]"
      >
        {msg.kind === 'ok' ? <CheckIcon className="flex-none text-ok" /> : <WarningIcon className="flex-none text-danger" />}
        <span className="truncate">{msg.text}</span>
      </div>
    </div>
  );
}
