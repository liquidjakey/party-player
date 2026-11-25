// Design Ref: §5.4 Pick name — FR-02. Apple-style grouped list.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo } from 'react';
import { upcomingOrder } from '@/domain/queue-order';
import { useEventLive } from '@/client/use-event-live';
import { useGuest } from '@/client/use-guest';
import { setGuestOrder } from '@/components/Avatar';
import { Floaters } from '@/components/Floaters';
import { NamePicker } from '@/components/NamePicker';
import { liveGate } from '@/components/StateScreen';

export function PickName({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const live = useEventLive(slug);
  setGuestOrder(live.guests);
  const { guest, save } = useGuest(slug);
  const waiting = useMemo(() => upcomingOrder(live.tracks, live.player?.currentTrackId ?? null), [live.tracks, live.player?.currentTrackId]);

  // Already picked (and still on the list)? Go straight to the queue.
  useEffect(() => {
    if (guest && live.status === 'live' && live.guests.some((g) => g.id === guest.id)) {
      router.replace(`/e/${slug}/queue`);
    }
  }, [guest, live.status, live.guests, router, slug]);

  const gate = liveGate(live.status, !!live.event, live.refresh);
  if (gate || !live.event) return gate;

  // One honest line about the party right now, from its real queue.
  const status = waiting.length
    ? `${waiting.length} ${waiting.length === 1 ? 'song' : 'songs'} in the queue`
    : live.tracks.length
      ? 'Nothing up next. Add a song'
      : 'No songs yet. Be the first';
  // Covers of the next songs. A song with no cover is left out, never shown as an empty box.
  const covers = waiting.filter((t) => t.thumbUrl).slice(0, 3);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-12">
      <Floaters variant="phone" />
      <header className="arrive mb-8">
        <h1 className="t-large">{live.event.name}</h1>
        <div className="mt-3 flex items-center gap-3">
          {covers.length > 0 && (
            <span aria-hidden className="flex flex-none -space-x-2">
              {covers.map((t) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={t.id}
                  src={t.thumbUrl}
                  alt=""
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  className="h-7 w-7 rounded-md object-cover ring-2 ring-bg"
                />
              ))}
            </span>
          )}
          <p className="min-w-0 truncate text-muted">{status}</p>
        </div>
      </header>
      <h2 className="t-section">Pick your name to add songs</h2>
      <NamePicker
        guests={live.guests}
        onPick={(g) => {
          save({ id: g.id, name: g.name });
          router.push(`/e/${slug}/queue`);
        }}
      />
      <p className="t-footnote mt-2 px-1 text-muted">No password. Your phone remembers your name.</p>
      <div className="mt-8 text-center">
        <Link href={`/e/${slug}/host`} className="press t-footnote inline-flex min-h-11 items-center px-3 text-muted underline underline-offset-4">
          I&apos;m the host
        </Link>
      </div>
    </main>
  );
}
