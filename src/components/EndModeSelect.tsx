'use client';
import { useState } from 'react';
import type { EndMode, PartyEvent } from '@/domain/types';
import { api, ApiError } from '@/client/api';

const MODES: { value: EndMode; label: string; hint: string }[] = [
  { value: 'loop', label: 'Loop', hint: 'Starts again from the first song' },
  { value: 'stop', label: 'Stop', hint: 'The music ends. A new song starts it again' },
  { value: 'live', label: 'Live Stream', hint: 'Plays a live stream until someone adds a song' },
];

/** FR-08 — iOS segmented control. The thumb moves on tap (optimistic) and moves back if saving fails. */
export function EndModeSelect({ event, onSaved }: { event: PartyEvent; onSaved: (msg: string) => void }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<EndMode | null>(null);
  const [seen, setSeen] = useState(event.endMode);
  if (event.endMode !== seen) {
    setSeen(event.endMode);
    setPending(null);
  }
  const mode = pending ?? event.endMode;
  const idx = MODES.findIndex((m) => m.value === mode);

  async function save(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ liveTitle: string | null }>(`/api/e/${event.slug}/host/settings`, { method: 'PATCH', body });
      onSaved(res.liveTitle ? `Live stream: ${res.liveTitle}` : okMsg);
      setLink('');
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something broke. Try again');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function choose(m: (typeof MODES)[number]) {
    if (m.value === mode) return;
    setPending(m.value);
    const ok = await save({ endMode: m.value }, `After the last song: ${m.label}`);
    if (!ok) setPending(null);
  }

  const liveLabel = event.liveSource
    ? event.liveSource.replace('https://www.', '').replace(/\/live$/, '')
    : event.liveVideoId
      ? `youtu.be/${event.liveVideoId}`
      : null;

  return (
    <section className="space-y-5">
      <div>
        <h3 className="t-section">After the last song</h3>
        <div className="card space-y-3 p-3">
          <div role="radiogroup" aria-label="After the last song" className="relative grid grid-cols-3 rounded-[10px] bg-fill p-0.5">
            <span
              aria-hidden
              className="absolute inset-y-0.5 left-0.5 rounded-lg bg-surface shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[var(--ease-out)]"
              style={{ width: 'calc((100% - 4px) / 3)', transform: `translateX(${idx * 100}%)` }}
            />
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => choose(m)}
                className={`relative z-10 min-h-11 rounded-lg text-[0.8125rem] font-semibold transition-opacity ${mode === m.value ? '' : 'opacity-70'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="t-footnote px-1 text-muted">{MODES[idx]?.hint}</p>
        </div>
      </div>

      <div>
        <h3 className="t-section">Live stream</h3>
        <div className="group">
          {liveLabel && (
            <div className="group-row">
              <span className="min-w-0 flex-1 truncate">{liveLabel}</span>
              <button type="button" disabled={busy} onClick={() => save({ clearLive: true }, 'Live stream removed')} className="press -mr-2 min-h-11 px-2 text-danger">
                Remove
              </button>
            </div>
          )}
          <form
            className="group-row tight"
            onSubmit={(e) => {
              e.preventDefault();
              if (link.trim()) save({ liveUrl: link.trim() }, 'Live stream saved');
            }}
          >
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={liveLabel ? 'Change stream link' : 'youtube.com/@LofiGirl'}
              aria-label="Live stream link"
              inputMode="url"
              autoCapitalize="off"
              className="min-h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
            />
            <button type="submit" disabled={busy || !link.trim()} className="press -mr-2 min-h-11 px-2 font-semibold text-accent-text disabled:opacity-30">
              {busy && link.trim() ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
        <p className={`t-footnote mt-1.5 px-1 ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
          {error ?? 'A channel link keeps working when its stream restarts'}
        </p>
      </div>
    </section>
  );
}
