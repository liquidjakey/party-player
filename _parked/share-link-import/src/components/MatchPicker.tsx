'use client';
import type { VideoMatch } from '@/domain/types';

const mmss = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

/** FR-12/FR-13 — up to 3 YouTube matches; the guest taps the right one. */
export function MatchPicker({
  heading,
  matches,
  busyId,
  onPick,
  onCancel,
}: {
  heading: string;
  matches: VideoMatch[];
  busyId: string | null;
  onPick: (m: VideoMatch) => void;
  onCancel: () => void;
}) {
  return (
    <section aria-label="Pick the right video" className="space-y-2 rounded-2xl border-2 border-accent bg-surface p-3">
      <p className="font-semibold">{heading}</p>
      {matches.length === 0 && <p className="text-muted">No matches. Try typing the song name differently.</p>}
      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.videoId}>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => onPick(m)}
              className="flex w-full items-center gap-3 rounded-xl border border-line p-2 text-left hover:border-accent disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.thumbUrl || `https://i.ytimg.com/vi/${m.videoId}/mqdefault.jpg`} alt="" className="h-14 w-24 flex-none rounded-lg object-cover bg-line" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-medium">{m.title}</span>
                <span className="block truncate text-sm text-muted">
                  {m.channel} {mmss(m.durationSec) && `· ${mmss(m.durationSec)}`}
                </span>
              </span>
              <span className="flex-none text-sm font-bold text-accent">{busyId === m.videoId ? 'Adding…' : 'Add'}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onCancel} className="min-h-11 w-full rounded-xl text-muted">
        None of these
      </button>
    </section>
  );
}
