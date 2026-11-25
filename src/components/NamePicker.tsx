'use client';
import type { Guest } from '@/domain/types';
import { Avatar } from './Avatar';
import { ChevronRightIcon } from './Icons';

/** FR-02 — an inset grouped list of names (iOS Settings style). Tap a row to pick. */
export function NamePicker({ guests, onPick }: { guests: Guest[]; onPick: (g: Guest) => void }) {
  if (guests.length === 0) {
    return <p className="card px-4 py-6 text-center text-muted">No names yet. Ask the host to add you</p>;
  }
  return (
    <ul className="group">
      {guests.map((g, i) => (
        <li key={g.id} className="arrive" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
          <button
            type="button"
            onClick={() => onPick(g)}
            className="group-row press w-full text-left active:bg-fill"
          >
            <Avatar name={g.name} />
            <span className="flex-1 truncate">{g.name}</span>
            <ChevronRightIcon className="flex-none text-faint" />
          </button>
        </li>
      ))}
    </ul>
  );
}
