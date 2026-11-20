// FR-02 — the device remembers which name the guest picked, per event (localStorage, wrapped in try/catch).
'use client';
import { useCallback, useSyncExternalStore } from 'react';

const key = (slug: string) => `pp_guest_${slug}`;

export interface SavedGuest {
  id: string;
  name: string;
}

function read(slug: string): SavedGuest | null {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as SavedGuest) : null;
  } catch {
    return null;
  }
}

const memory = new Map<string, string>(); // fallback when localStorage is blocked
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useGuest(slug: string) {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener('storage', cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('storage', cb);
    };
  }, []);
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key(slug)) ?? memory.get(key(slug)) ?? null;
      } catch {
        return memory.get(key(slug)) ?? null;
      }
    },
    () => undefined,
  );
  const guest = raw === undefined ? undefined : raw ? (JSON.parse(raw) as SavedGuest) : null;

  const save = useCallback(
    (g: SavedGuest | null) => {
      if (g) memory.set(key(slug), JSON.stringify(g));
      else memory.delete(key(slug));
      try {
        if (g) localStorage.setItem(key(slug), JSON.stringify(g));
        else localStorage.removeItem(key(slug));
      } catch {
        /* private mode: the in-memory copy keeps the name for this visit */
      }
      emit();
    },
    [slug],
  );

  /** undefined = not loaded yet (server render), null = no name picked. */
  return { guest, save, read: () => read(slug) };
}
