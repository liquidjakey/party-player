// Design Ref: §5.4 Guest queue — FR-03, FR-04, FR-05, FR-09. Apple-style grouped layout.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { upcomingOrder } from '@/domain/queue-order';
import type { Track } from '@/domain/types';
import { api, ApiError } from '@/client/api';
import { useEventLive } from '@/client/use-event-live';
import { useGuest } from '@/client/use-guest';
import { AddSongBox } from '@/components/AddSongBox';
import { Avatar, setGuestOrder } from '@/components/Avatar';
import { Floaters } from '@/components/Floaters';
import { NavBar } from '@/components/NavBar';
import { QueueList } from '@/components/QueueList';
import { ReconnectPill } from '@/components/ReconnectPill';
import { liveGate } from '@/components/StateScreen';
import { Toast, type ToastMsg } from '@/components/Toast';

export function Queue({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const live = useEventLive(slug);
  setGuestOrder(live.guests);
  const { guest, save } = useGuest(slug);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  // No name picked, or the host removed this name → back to the picker.
  useEffect(() => {
    if (guest === null) router.replace(`/e/${slug}`);
    else if (guest && live.status === 'live' && !live.guests.some((g) => g.id === guest.id)) {
      save(null);
      router.replace(`/e/${slug}`);
    }
  }, [guest, live.status, live.guests, router, save, slug]);

  const names = useMemo(() => new Map(live.guests.map((g) => [g.id, g.name])), [live.guests]);
  const nameOf = useCallback((id: string | null) => (id ? (names.get(id) ?? 'someone') : 'host'), [names]);
  const currentId = live.player?.currentTrackId ?? null;
  const upcoming = useMemo(() => upcomingOrder(live.tracks, currentId), [live.tracks, currentId]);
  const mineCount = upcoming.filter((t) => t.addedBy === guest?.id).length;

  const gate = liveGate(live.status, !!live.event, live.refresh);
  if (gate) return gate;
  if (!live.event || !guest) return liveGate('loading', false, live.refresh);

  /** YouTube / YouTube Music links only (search + other apps parked, see _parked/share-link-import). */
  async function add(text: string): Promise<{ error: string } | { title: string }> {
    try {
      const track = await api<Track>(`/api/e/${slug}/tracks`, { body: { guestId: guest!.id, url: text } });
      live.refresh();
      return { title: track.title };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'GUEST_NOT_FOUND') save(null);
      return { error: e instanceof ApiError ? e.message : 'Something broke. Try again' };
    }
  }

  async function remove(t: Track): Promise<boolean> {
    try {
      await api(`/api/e/${slug}/tracks/${t.id}`, { method: 'DELETE', body: { guestId: guest!.id } });
      setToast({ id: Date.now(), kind: 'ok', text: 'Removed' });
      live.refresh();
      return true;
    } catch (e) {
      setToast({ id: Date.now(), kind: 'error', text: e instanceof ApiError ? e.message : 'Something broke. Try again' });
      return false;
    }
  }

  const waiting = upcoming.length;
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28">
      <NavBar
        title={live.event.name}
        trailing={
          <Link href={`/e/${slug}`} onClick={() => save(null)} className="press -mr-2 flex min-h-11 items-center gap-2 px-2" aria-label={`Signed in as ${guest.name}. Switch name`}>
            <span className="t-footnote text-muted">Not you?</span>
            <Avatar name={guest.name} size={32} />
          </Link>
        }
      />
      <Floaters variant="phone" />
      <ReconnectPill show={live.status === 'reconnecting'} />

      <div className="mt-4 space-y-7">
        <section>
          <h2 className="t-section">Add a song</h2>
          <AddSongBox onSubmit={add} />
        </section>

        <section aria-label="Queue">
          <h2 className="t-section flex items-baseline justify-between">
            <span>Up next</span>
            <span className="tabular-nums">
              {waiting} {waiting === 1 ? 'song' : 'songs'}
              {mineCount ? ` · ${mineCount} yours` : ''}
            </span>
          </h2>
          <QueueList tracks={upcoming} nameOf={nameOf} canRemove={(t) => t.addedBy === guest.id} onRemove={remove} />
        </section>
      </div>

      <Toast msg={toast} onDone={clearToast} />
    </main>
  );
}
