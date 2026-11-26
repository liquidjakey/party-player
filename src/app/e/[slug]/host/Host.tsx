// Design Ref: §5.4 Host — FR-10, FR-11, FR-08, FR-14. PIN-protected remote + settings.
// Order: what the host needs mid-party first (now playing, controls, songs), settings last.
'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { upcomingOrder } from '@/domain/queue-order';
import { youtubeQueueLinks } from '@/domain/youtube-url';
import type { Track } from '@/domain/types';
import { api, ApiError } from '@/client/api';
import { shareLink } from '@/client/share';
import { useEventLive } from '@/client/use-event-live';
import { setGuestOrder } from '@/components/Avatar';
import { EndModeSelect } from '@/components/EndModeSelect';
import { GuestListEditor } from '@/components/GuestListEditor';
import { HostControls } from '@/components/HostControls';
import { ChevronRightIcon, LinkIcon, PlayIcon, TvIcon } from '@/components/Icons';
import { NavBar } from '@/components/NavBar';
import { NowPlaying } from '@/components/NowPlaying';
import { QueueList } from '@/components/QueueList';
import { ReconnectPill } from '@/components/ReconnectPill';
import { liveGate, StateScreen } from '@/components/StateScreen';
import { SyncStatus, type SyncSummary } from '@/components/SyncStatus';
import { Toast, type ToastMsg } from '@/components/Toast';

interface Status {
  host: true;
  notice: string | null;
  sync: SyncSummary;
}
/** null = needs the PIN; 'loading' = first check; 'error' = couldn't reach the server yet. */
type HostStatus = Status | null | 'loading' | 'error';

const GOOGLE_MSG: Record<string, string> = {
  ok: 'YouTube connected. Copying songs to your backup playlist…',
  denied: 'YouTube was not connected',
  error: 'YouTube connection failed. Try again',
};

// A failed poll keeps the last good status, so the remote never disappears mid-party.
const keep = (s: HostStatus) => (prev: HostStatus) => (s === 'error' && prev && prev !== 'loading' && prev !== 'error' ? prev : s);

export function Host({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const search = useSearchParams();
  const live = useEventLive(slug);
  setGuestOrder(live.guests);
  const [status, setStatus] = useState<HostStatus>('loading');
  const [shareFallback, setShareFallback] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(() => {
    const g = search.get('google');
    return g && GOOGLE_MSG[g] ? { id: 1, kind: g === 'ok' ? 'ok' : 'error', text: GOOGLE_MSG[g] } : null;
  });
  const clearToast = useCallback(() => setToast(null), []);
  const say = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => setToast({ id: Date.now(), kind, text }), []);

  const fetchStatus = useCallback(
    (): Promise<HostStatus> =>
      api<Status>(`/api/e/${slug}/host/status`).catch((e) => (e instanceof ApiError && e.code === 'UNAUTHORIZED' ? null : 'error')),
    [slug],
  );
  const loadStatus = useCallback(() => {
    fetchStatus().then((s) => setStatus(keep(s)));
  }, [fetchStatus]);

  const trackKey = live.tracks.map((t) => `${t.id}:${t.syncStatus}`).join(',');
  useEffect(() => {
    let alive = true;
    const run = () => fetchStatus().then((s) => alive && setStatus(keep(s)));
    run();
    const t = setInterval(run, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [fetchStatus, trackKey, live.event?.notice]);

  const names = useMemo(() => new Map(live.guests.map((g) => [g.id, g.name])), [live.guests]);
  const nameOf = useCallback((id: string | null) => (id ? (names.get(id) ?? 'someone') : 'host'), [names]);
  const currentId = live.player?.currentTrackId ?? null;
  const current = live.tracks.find((t) => t.id === currentId) ?? null;
  // Reorder shows at once. The new order is kept while the save runs, and until fresh data arrives after it.
  const [pending, setPending] = useState<{ seq: number; ids: string[]; until: Track[] | null } | null>(null);
  const reorderSeq = useRef(0);
  const tracksNow = useRef(live.tracks);
  useEffect(() => {
    tracksNow.current = live.tracks;
  });
  const order = pending && (pending.until === null || pending.until === live.tracks) ? pending.ids : null;
  const upcoming = useMemo(() => {
    const base = upcomingOrder(live.tracks, currentId);
    if (!order) return base;
    const rank = new Map(order.map((id, i) => [id, i]));
    return [...base].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  }, [live.tracks, currentId, order]);
  const songs = useMemo(() => [...(current ? [current] : []), ...upcoming], [current, upcoming]);
  const youtubeLinks = useMemo(() => youtubeQueueLinks(songs.filter((t) => t.status === 'ok').map((t) => t.videoId)), [songs]);

  const gate = liveGate(live.status, !!live.event, live.refresh);
  if (gate) return gate;
  if (!live.event || status === 'loading') return <StateScreen title="Loading…" />;
  if (status === 'error') return <StateScreen title="Can't reach the party" text="Check the Wi-Fi and try again" onRetry={loadStatus} />;
  if (status === null) return <PinForm slug={slug} name={live.event.name} onDone={loadStatus} />;

  const event = live.event;

  async function settings(body: Record<string, unknown>, okMsg: string): Promise<boolean> {
    try {
      await api(`/api/e/${slug}/host/settings`, { method: 'PATCH', body });
      say(okMsg);
      live.refresh();
      return true;
    } catch (e) {
      say(e instanceof ApiError ? e.message : 'Something broke. Try again', 'error');
      return false;
    }
  }

  async function removeSong(t: Track): Promise<boolean> {
    try {
      await api(`/api/e/${slug}/tracks/${t.id}`, { method: 'DELETE', body: {} });
      say('Removed');
      live.refresh();
      return true;
    } catch (e) {
      say(e instanceof ApiError ? e.message : 'Something broke. Try again', 'error');
      return false;
    }
  }

  async function reorder(ids: string[]) {
    const seq = ++reorderSeq.current;
    setPending({ seq, ids, until: null });
    try {
      await api(`/api/e/${slug}/host/reorder`, { body: { order: ids } });
      setPending((p) => (p?.seq === seq ? { ...p, until: tracksNow.current } : p));
      live.refresh();
    } catch (e) {
      setPending((p) => (p?.seq === seq ? null : p));
      say(e instanceof ApiError ? e.message : 'Something broke. Try again', 'error');
    }
  }

  async function shareGuestLink() {
    const url = `${window.location.origin}/e/${slug}`;
    const r = await shareLink(url, event.name);
    if (r === 'copied') say('Guest link copied');
    if (r === 'failed') setShareFallback(url);
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28">
      <NavBar
        title={event.name}
        kicker="Host"
        trailing={
          <button
            type="button"
            onClick={async () => {
              await api(`/api/e/${slug}/host/logout`, { body: {} }).catch(() => {});
              setStatus(null);
            }}
            className="press -mr-2 min-h-11 px-2 text-accent-text"
          >
            Log Out
          </button>
        }
      />
      <ReconnectPill show={live.status === 'reconnecting'} />

      <div className="mt-4 space-y-7">
        {status.notice === 'live_ended' && (
          <div className="card materialize flex items-center gap-3 p-3.5">
            <p className="flex-1 text-[0.9375rem]">The live stream ended, so the party switched to Loop</p>
            <button type="button" onClick={() => settings({ clearNotice: true }, 'OK')} className="press -mr-2 min-h-11 px-2 font-semibold text-accent-text">
              OK
            </button>
          </div>
        )}

        <section className="space-y-5">
          <NowPlaying event={event} player={live.player} track={current} addedByName={current ? nameOf(current.addedBy) : null} firstAddedBy={upcoming[0] ? nameOf(upcoming[0].addedBy) : null} upNext={upcoming} />
          <HostControls send={(action) => api(`/api/e/${slug}/host/control`, { body: { action } })} isPlaying={live.player?.isPlaying ?? false} onError={(m) => say(m, 'error')} />
        </section>

        <section>
          <h2 className="t-section tabular-nums">Songs · {live.tracks.length}</h2>
          <QueueList tracks={songs} nameOf={nameOf} canRemove={() => true} onRemove={removeSong} firstLabel={current ? 'Playing' : undefined} onReorder={reorder} pinnedFirst={!!current} />
        </section>

        <section>
          <h2 className="t-section">Share</h2>
          <div className="group">
            <button type="button" onClick={shareGuestLink} className="group-row press w-full text-left">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-ink">
                <LinkIcon />
              </span>
              <span className="flex-1">Share Guest Link</span>
            </button>
            <Link href={`/e/${slug}/tv`} className="group-row press">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-cocoa text-white">
                <TvIcon />
              </span>
              <span className="flex-1">Open TV Page</span>
              <ChevronRightIcon className="text-faint" />
            </Link>
            {/* Backup: the whole queue as a YouTube playlist, built from the songs right now */}
            {youtubeLinks.map((l) => (
              <a key={l.from} href={l.url} target="_blank" rel="noopener noreferrer" className="group-row press">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-cranberry text-[0.8125rem] text-white">
                  <PlayIcon />
                </span>
                <span className="flex-1">
                  Open in YouTube
                  <span className="text-muted tabular-nums">
                    {youtubeLinks.length > 1 ? ` · Songs ${l.from}–${l.to}` : ` · ${l.to} ${l.to === 1 ? 'song' : 'songs'}`}
                  </span>
                </span>
                <ChevronRightIcon className="text-faint" />
              </a>
            ))}
          </div>
          {youtubeLinks.length > 0 && (
            <p className="t-footnote mt-1.5 px-1 text-muted">
              Backup if the TV page fails: opens the songs in play order in the YouTube app. Cast it to the TV from there. Tap again later to include new songs
            </p>
          )}
          {shareFallback && (
            <p className="t-footnote mt-1.5 px-1 text-muted">
              Copy this link: <span className="select-all font-medium text-ink">{shareFallback}</span>
            </p>
          )}
        </section>

        <section>
          <h2 className="t-section tabular-nums">Guests · {live.guests.length}</h2>
          <GuestListEditor
            names={live.guests.map((g) => ({ key: g.id, name: g.name }))}
            onAdd={(added) => settings({ guests: { add: added } }, added.length === 1 ? `Added ${added[0]}` : `Added ${added.length} guests`)}
            onRemove={(id, name) => settings({ guests: { remove: [id] } }, `Removed ${name}`)}
            canRemove={(id) => !live.tracks.some((t) => t.addedBy === id)}
            removeNote="Guests who added songs can't be removed until their songs are gone"
          />
        </section>

        <section className="space-y-5 border-t border-line pt-6">
          <h2 className="t-title px-1">Settings</h2>
          <PartyName name={event.name} onSave={(name) => settings({ name }, 'Party name saved')} />
          <EndModeSelect
            event={event}
            onSaved={(m) => {
              say(m);
              live.refresh();
            }}
          />
          <SyncStatus slug={slug} sync={status.sync} onChange={loadStatus} />
        </section>
      </div>

      <Toast msg={toast} onDone={clearToast} />
    </main>
  );
}

function PinForm({ slug, name, onDone }: { slug: string; name: string; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 pt-[max(4rem,env(safe-area-inset-top))]">
      <div className="arrive">
        <h1 className="t-large">{name}</h1>
        <p className="mt-2 text-muted">Enter the host PIN to open the remote</p>
      </div>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api(`/api/e/${slug}/host/login`, { body: { pin } });
            onDone();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something broke. Try again');
            setPin('');
            setShakeKey((k) => k + 1);
            navigator.vibrate?.(30);
            setTimeout(() => input.current?.focus(), 0);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span className="sr-only">Host PIN</span>
          <input
            key={shakeKey}
            ref={input}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            inputMode="numeric"
            type="password"
            autoComplete="off"
            autoFocus
            aria-invalid={!!error}
            aria-describedby="pin-help"
            className={`h-14 w-full rounded-xl bg-surface text-center text-[1.75rem] tracking-[0.5em] outline-none ring-1 focus:ring-2 focus:ring-accent ${
              error ? 'shake ring-2 ring-danger' : 'ring-line'
            }`}
          />
        </label>
        <p id="pin-help" className={`t-footnote min-h-5 text-center ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
          {error ?? '4 to 6 digits, chosen when the party was made'}
        </p>
        <button type="submit" disabled={busy || pin.length < 4} className="press btn-primary min-h-12 w-full rounded-xl text-[1.0625rem] font-semibold">
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}

function PartyName({ name, onSave }: { name: string; onSave: (name: string) => Promise<boolean> }) {
  const [value, setValue] = useState(name);
  const [seen, setSeen] = useState(name);
  const [busy, setBusy] = useState(false);
  if (name !== seen) {
    setSeen(name);
    setValue(name);
  }
  const changed = value.trim() && value.trim() !== name;
  return (
    <div>
      <h3 className="t-section">Party name</h3>
      <div className="group">
      <form
        className="group-row tight"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!changed || busy) return;
          setBusy(true);
          await onSave(value.trim());
          setBusy(false);
        }}
      >
        <input
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Party name"
          enterKeyHint="done"
          className="min-h-9 min-w-0 flex-1 bg-transparent outline-none"
        />
        <button type="submit" disabled={!changed || busy} className="press -mr-2 min-h-11 px-2 font-semibold text-accent-text disabled:opacity-30">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
      </div>
      <p className="t-footnote mt-1.5 px-1 text-muted">Shows on the TV and on guests&apos; phones</p>
    </div>
  );
}
