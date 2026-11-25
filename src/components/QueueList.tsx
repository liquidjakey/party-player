'use client';
import { useEffect, useRef, useState } from 'react';
import { SETTLE_MS, useListMotion } from '@/client/use-list-motion';
import type { Track } from '@/domain/types';
import { tintFor } from './Avatar';
import { GripIcon, MinusCircleIcon, WarningIcon } from './Icons';

type Drag = { id: string; from: number; to: number; dy: number; step: number };

/**
 * FR-05 — the queue as an inset grouped list. Removable rows get the iOS red minus; tapping it reveals
 * a "Remove" button in the row (the server checks ownership again). A removed row fades while it goes.
 * With `onReorder` (host only), each row gets a grip on the right: drag it, or focus it and use the arrow keys.
 * `pinnedFirst` keeps row 0 (the song playing now) in place.
 */
export function QueueList({
  tracks,
  nameOf,
  canRemove,
  onRemove,
  firstLabel,
  onReorder,
  pinnedFirst = false,
}: {
  tracks: Track[];
  nameOf: (guestId: string | null) => string;
  canRemove: (t: Track) => boolean;
  onRemove: (t: Track) => Promise<boolean>;
  firstLabel?: string;
  onReorder?: (ids: string[]) => void;
  pinnedFirst?: boolean;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [settling, setSettling] = useState<string | null>(null); // just dropped: stays on top while it slides into place
  const list = useRef<HTMLOListElement>(null);
  const { capture, skipNext } = useListMotion(list, tracks.map((t) => t.id), !!drag);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const grips = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<string | null>(null);
  const held = useRef<Drag | null>(null);
  const start = pinnedFirst ? 1 : 0; // first movable row
  const movable = tracks.length - start;

  // Keyboard moves re-insert the row; put focus back on its grip
  useEffect(() => {
    if (refocus.current) grips.current.get(refocus.current)?.focus();
    refocus.current = null;
  }, [tracks]);

  useEffect(() => {
    if (!settling) return;
    const t = setTimeout(() => setSettling(null), SETTLE_MS);
    return () => clearTimeout(t);
  }, [settling]);

  if (tracks.length === 0) {
    return <p className="card px-4 py-6 text-center text-muted">Nothing up next. Add a song</p>;
  }

  function commit(from: number, to: number) {
    if (from === to || !onReorder) return;
    const ids = tracks.slice(start).map((t) => t.id);
    const [moved] = ids.splice(from - start, 1);
    ids.splice(to - start, 0, moved);
    onReorder(ids);
  }

  function startDrag(e: React.PointerEvent<HTMLButtonElement>, t: Track, index: number) {
    if (e.button !== 0 || movable < 2) return;
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    const a = rows.current.get(tracks[start]?.id)?.getBoundingClientRect();
    const b = rows.current.get(tracks[start + 1]?.id)?.getBoundingClientRect();
    const step = a && b ? b.top - a.top : (a?.height ?? 60);
    const startY = e.clientY;
    const startScroll = window.scrollY;
    let lastY = e.clientY;
    let raf = 0;
    navigator.vibrate?.(8);

    const update = () => {
      const dy = lastY - startY + (window.scrollY - startScroll);
      const to = Math.min(tracks.length - 1, Math.max(start, index + Math.round(dy / step)));
      held.current = { id: t.id, from: index, to, dy, step };
      setDrag(held.current);
    };
    // Scroll the page while the row is held near the top or bottom edge
    const tick = () => {
      const edge = 96;
      const speed = lastY < edge ? -(edge - lastY) / 6 : lastY > innerHeight - edge ? (lastY - (innerHeight - edge)) / 6 : 0;
      if (speed) {
        window.scrollBy(0, speed);
        update();
      }
      raf = requestAnimationFrame(tick);
    };
    const move = (ev: PointerEvent) => {
      lastY = ev.clientY;
      update();
    };
    const end = (ev: PointerEvent) => {
      cancelAnimationFrame(raf);
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
      const d = held.current;
      held.current = null;
      capture(); // rows settle from where they are on screen
      setDrag(null);
      setSettling(t.id);
      if (d && ev.type === 'pointerup') commit(d.from, d.to); // a cancelled touch puts the row back
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    update();
    raf = requestAnimationFrame(tick);
  }

  function shiftOf(j: number): number {
    if (!drag || j === drag.from) return 0;
    const { step } = drag;
    if (drag.from < drag.to && j > drag.from && j <= drag.to) return -step;
    if (drag.from > drag.to && j >= drag.to && j < drag.from) return step;
    return 0;
  }

  return (
    <ol ref={list} className="group relative isolate">
      {tracks.map((t, i) => {
        const mine = canRemove(t);
        const open = confirming === t.id;
        const going = removing.has(t.id);
        const canMove = !!onReorder && i >= start && movable > 1;
        const lifted = drag?.id === t.id;
        const shift = lifted ? drag.dy : shiftOf(i);
        return (
          <li
            key={t.id}
            data-key={t.id}
            ref={(el) => {
              if (el) rows.current.set(t.id, el);
              else rows.current.delete(t.id);
            }}
            style={{
              ...(shift ? { transform: `translateY(${shift}px)` } : {}),
              ...(lifted ? { boxShadow: '0 8px 24px rgba(42,23,16,.18)' } : {}),
            }}
            className={`group-row relative bg-surface py-2 ${going ? 'pointer-events-none opacity-40' : ''} ${
              lifted
                ? 'z-10'
                : settling === t.id
                  ? 'z-10 transition-shadow duration-200'
                : drag
                  ? 'transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)]'
                  : 'transition-opacity duration-200'
            }`}
          >
            {mine && (
              <button
                type="button"
                aria-label={open ? 'Cancel' : `Remove ${t.title}`}
                aria-expanded={open}
                onClick={() => setConfirming(open ? null : t.id)}
                className={`press hit -ml-1 grid h-8 w-8 flex-none place-items-center text-[1.375rem] text-danger transition-transform duration-200 ${
                  open ? 'rotate-90' : ''
                }`}
              >
                <MinusCircleIcon />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.thumbUrl || undefined} alt="" className="h-11 w-11 flex-none rounded-lg bg-fill object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-medium">{t.title}</p>
              <p className="t-footnote flex items-center gap-1 truncate text-muted">
                {i === 0 && firstLabel ? <span className="font-semibold text-accent-text">{firstLabel} · </span> : null}
                <span aria-hidden className={`inline-block h-2 w-2 flex-none rounded-full ${tintFor(nameOf(t.addedBy))}`} />
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
                onClick={async () => {
                  setConfirming(null);
                  setRemoving((s) => new Set(s).add(t.id));
                  const ok = await onRemove(t);
                  if (!ok)
                    setRemoving((s) => {
                      const n = new Set(s);
                      n.delete(t.id);
                      return n;
                    });
                }}
                className="press materialize min-h-11 flex-none rounded-lg bg-danger px-3 text-[0.9375rem] font-semibold text-white"
              >
                Remove
              </button>
            )}
            {canMove && !open && (
              <button
                type="button"
                ref={(el) => {
                  if (el) grips.current.set(t.id, el);
                  else grips.current.delete(t.id);
                }}
                aria-label={`Move ${t.title}. Use the up and down arrow keys`}
                onPointerDown={(e) => startDrag(e, t, i)}
                onKeyDown={(e) => {
                  const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
                  if (to === null) return;
                  e.preventDefault();
                  if (to < start || to >= tracks.length) return;
                  refocus.current = t.id;
                  skipNext();
                  commit(i, to);
                }}
                className={`hit -mr-1 grid h-8 w-8 flex-none touch-none select-none place-items-center text-[1.25rem] text-faint ${
                  lifted ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <GripIcon />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
