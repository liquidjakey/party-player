'use client';
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/** The app's --ease-out, for animations made in script. */
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const MOVE_MS = 300;
const EXIT_MS = 150;
const SETTLE_MS = 200;

/**
 * Motion for a list whose rows have `data-key`: a new row arrives, a moved row slides from its old place to its
 * new one (FLIP: transform only), a removed row fades out while the rows below close the gap.
 * Arrivals run here, not from a CSS class, because moving a row in the DOM would replay a CSS animation.
 *
 * - `capture()`: call when a drag ends, so rows start from where they look, not from where they were laid out.
 * - `skipNext()`: the next change is instant (keyboard moves).
 * - `paused`: no motion while a row is held.
 */
export function useListMotion(list: RefObject<HTMLElement | null>, keys: string[], paused = false) {
  const tops = useRef(new Map<string, number>());
  const nodes = useRef(new Map<string, HTMLElement>());
  const moving = useRef(new Map<string, Animation>());
  const order = useRef('');
  const captured = useRef(false);
  const skip = useRef(false);

  useLayoutEffect(() => {
    const box = list.current;
    if (!box) {
      tops.current.clear();
      nodes.current.clear();
      moving.current.clear();
      order.current = '';
      return;
    }
    const next = new Map<string, number>();
    const nextNodes = new Map<string, HTMLElement>();
    for (const el of box.querySelectorAll<HTMLElement>(':scope > [data-key]')) {
      next.set(el.dataset.key!, el.offsetTop - (el.offsetParent === box ? 0 : box.offsetTop));
      nextNodes.set(el.dataset.key!, el);
    }
    const prev = tops.current;
    const prevNodes = nodes.current;
    const now = keys.join();
    const changed = now !== order.current || captured.current;
    const animate = changed && !paused && !skip.current;
    const settle = captured.current;
    if (changed) skip.current = false;
    captured.current = false;
    order.current = now;
    tops.current = next;
    nodes.current = nextNodes;
    if (!animate) return;

    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bottom = box.clientHeight;

    for (const [key, top] of next) {
      const el = nextNodes.get(key)!;
      const was = prev.get(key);
      if (was === undefined) {
        el.animate(
          calm
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [{ opacity: 0, transform: 'translateY(8px) scale(0.98)' }, { opacity: 1, transform: 'none' }],
          { duration: calm ? 200 : 420, easing: EASE, fill: 'backwards' },
        );
        continue;
      }
      // A row that is still sliding starts again from where it is on screen now
      const running = moving.current.get(key);
      const offset = running?.playState === 'running' ? new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 : 0;
      const from = was + offset - top;
      if (Math.abs(from) < 1) continue;
      if (was >= bottom && top >= bottom) continue; // out of sight (the TV list is cut off at the bottom)
      running?.cancel();
      moving.current.set(
        key,
        calm
          ? el.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 150 })
          : el.animate([{ transform: `translateY(${from}px)` }, { transform: 'none' }], {
              duration: settle ? SETTLE_MS : MOVE_MS,
              easing: EASE,
            }),
      );
    }

    // Removed rows: fade a copy in the old place. Only for a few, so switching to another list stays instant.
    const gone = [...prev.keys()].filter((k) => !next.has(k));
    if (next.size === 0 || gone.length > 3) return;
    for (const key of gone) {
      const top = prev.get(key)!;
      const old = prevNodes.get(key);
      if (!old || top >= bottom) continue;
      const ghost = old.cloneNode(true) as HTMLElement;
      delete ghost.dataset.key;
      ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.cssText = `position:absolute;top:${top}px;left:0;right:0;margin:0;z-index:-1;pointer-events:none`;
      const start = old.classList.contains('opacity-40') ? 0.4 : 1;
      box.appendChild(ghost);
      const fade = ghost.animate([{ opacity: start }, { opacity: 0 }], { duration: EXIT_MS, easing: 'ease-out', fill: 'forwards' });
      fade.onfinish = fade.oncancel = () => ghost.remove();
    }
  });

  const capture = useCallback(() => {
    for (const [key, el] of nodes.current) {
      const top = tops.current.get(key);
      if (top === undefined) continue;
      const t = getComputedStyle(el).transform;
      moving.current.get(key)?.cancel();
      tops.current.set(key, top + (t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42));
    }
    captured.current = true;
  }, []);
  const skipNext = useCallback(() => {
    skip.current = true;
  }, []);
  return { capture, skipNext };
}

export { SETTLE_MS };
