// Design Ref: §5.4 Pick name — FR-02. Apple-style grouped list.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { useEventLive } from '@/client/use-event-live';
import { setGuestOrder } from '@/components/Avatar';
import { useGuest } from '@/client/use-guest';
import { LeafIcon } from '@/components/Icons';
import { NamePicker } from '@/components/NamePicker';

export function PickName({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const live = useEventLive(slug);
  const { guest, save } = useGuest(slug);
  setGuestOrder(live.guests.map((g) => g.name));

  // Already picked (and still on the list)? Go straight to the queue.
  useEffect(() => {
    if (guest && live.status === 'live' && live.guests.some((g) => g.id === guest.id)) {
      router.replace(`/e/${slug}/queue`);
    }
  }, [guest, live.status, live.guests, router, slug]);

  if (live.status === 'not_found') return <Center title="Party not found" text="Check the link with the host" />;
  if (live.status === 'loading' || !live.event) return <Center title="Loading…" />;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-12">
      <div className="arrive mb-8 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-2xl text-white">
          <LeafIcon />
        </span>
        <p className="t-footnote font-medium text-muted">You&apos;re invited</p>
        <h1 className="t-large mt-1">{live.event.name}</h1>
        <p className="mt-2 text-muted">Pick your name to add songs</p>
      </div>
      <h2 className="t-section">Who are you?</h2>
      <NamePicker
        guests={live.guests}
        onPick={(g) => {
          save({ id: g.id, name: g.name });
          router.push(`/e/${slug}/queue`);
        }}
      />
      <p className="t-footnote mt-2 px-1 text-muted">No password. Your phone remembers your name.</p>
      <Link href={`/e/${slug}/host`} className="press t-footnote mt-10 block text-center text-muted underline underline-offset-4">
        I&apos;m the host
      </Link>
    </main>
  );
}

function Center({ title, text }: { title: string; text?: string }) {
  return (
    <main className="grid flex-1 place-items-center px-4 text-center">
      <div>
        <h1 className="t-title">{title}</h1>
        {text && <p className="mt-1 text-muted">{text}</p>}
      </div>
    </main>
  );
}
