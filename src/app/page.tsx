// Design Ref: §5.4 Admin — create a reusable event (FR-01). iOS grouped form.
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/client/api';
import { shareLink } from '@/client/share';
import { Toast, type ToastMsg } from '@/components/Toast';
import { GuestListEditor } from '@/components/GuestListEditor';
import { ChevronRightIcon, LinkIcon, MusicIcon, TvIcon } from '@/components/Icons';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** The country used to refuse region-blocked videos, read from the device's language (ko-KR → KR). Korea if unknown. */
function deviceRegion(): string {
  try {
    const tag = navigator.languages?.find((l) => /-[A-Za-z]{2}$/.test(l)) ?? navigator.language;
    const m = tag?.match(/-([A-Za-z]{2})$/);
    if (m) return m[1].toUpperCase();
    if (tag?.startsWith('ko')) return 'KR';
  } catch {
    /* no navigator */
  }
  return 'KR';
}

export default function AdminPage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [guests, setGuests] = useState<string[]>([]);
  const [hostPin, setHostPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState<{ field: 'name' | 'link' | 'pin'; text: string } | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  useEffect(() => {
    api<{ adminPinRequired: boolean }>('/api/events').then((c) => setNeedsAdmin(c.adminPinRequired), () => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ slug: string }>('/api/events', {
        body: { ...(needsAdmin ? { adminPin } : {}), name: name.trim(), slug, guests, hostPin, region: deviceRegion() },
      });
      setCreated(res.slug);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      const text = err instanceof ApiError ? err.message : 'Something broke. Try again';
      // Show the error next to the field it is about
      setError({ field: code === 'SLUG_TAKEN' ? 'link' : 'pin', text });
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const links = [
      { label: 'Guests', note: 'Send this to friends', path: `/e/${created}`, icon: <LinkIcon />, tint: 'bg-accent text-accent-ink', share: true },
      { label: 'TV', note: 'Open on the projector', path: `/e/${created}/tv`, icon: <TvIcon />, tint: 'bg-cocoa text-white', share: false },
      { label: 'Host remote', note: 'Your phone, with the host PIN', path: `/e/${created}/host`, icon: <MusicIcon />, tint: 'bg-cranberry text-white', share: false },
    ];
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-12">
        <div className="materialize">
          <h1 className="t-large">{name.trim() || 'Party'} is ready</h1>
          <p className="mt-2 text-muted">Share the guest link with friends. Bookmark the host remote on your phone.</p>
        </div>
        <ul className="group mt-8">
          {links.map((l, i) => (
            <li key={l.path} className="group-row arrive" style={{ animationDelay: `${i * 60}ms` }}>
              <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${l.tint}`}>{l.icon}</span>
              <Link href={l.path} className="press min-w-0 flex-1">
                <span className="block">
                  {l.label} <span className="text-muted">· {l.note}</span>
                </span>
                <span className="t-footnote block truncate text-muted">
                  {origin}
                  {l.path}
                </span>
              </Link>
              {l.share ? (
                <button
                  type="button"
                  onClick={async () => {
                    const r = await shareLink(`${origin}${l.path}`, name.trim());
                    setToast({
                      id: Date.now(),
                      kind: r === 'failed' ? 'error' : 'ok',
                      text: r === 'copied' ? 'Guest link copied' : r === 'failed' ? 'Couldn\'t copy. Press and hold the link instead' : 'Shared',
                    });
                  }}
                  className="press btn-primary -mr-1 min-h-11 flex-none rounded-lg px-3 text-[0.9375rem] font-semibold"
                >
                  Share
                </button>
              ) : (
                <ChevronRightIcon className="flex-none text-faint" />
              )}
            </li>
          ))}
        </ul>
        <Toast msg={toast} onDone={() => setToast(null)} />
      </main>
    );
  }

  const row = 'group-row';
  const input = 'min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint';
  const missing = !name.trim()
    ? 'Give the party a name'
    : slug.length < 2
      ? 'Add a short link (2 or more letters)'
      : !/^\d{4,6}$/.test(hostPin)
        ? 'Host PIN needs 4 to 6 digits'
        : needsAdmin && !adminPin
          ? 'Enter the admin PIN'
          : null;
  const ready = !missing;
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-16">
      <div className="arrive mb-8">
        <h1 className="t-large">New Party</h1>
        <p className="mt-2 text-muted">A shared YouTube queue. Guests add songs from their phones, the TV plays them.</p>
      </div>

      <form onSubmit={submit} className="space-y-7">
        <section>
          <h2 className="t-section">Party</h2>
          <div className="group">
            <label className={row}>
              <span className="flex-none">Name</span>
              <input
                className={input}
                value={name}
                maxLength={60}
                required
                placeholder="Friendsgiving"
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
              />
            </label>
            <label className={row}>
              <span className="flex-none">Link</span>
              <span className="flex min-w-0 flex-1 items-center justify-end text-muted">
                /e/
                <input
                  className="field-sizing-content min-w-0 bg-transparent text-ink outline-none placeholder:text-faint supports-[field-sizing:content]:w-auto!"
                  style={{ width: `${Math.max(slug.length, 13)}ch` }}
                  value={slug}
                  required
                  pattern="[a-z0-9\-]{2,40}"
                  autoCapitalize="off"
                  placeholder="friendsgiving"
                  onChange={(e) => {
                    if (error?.field === 'link') setError(null);
                    setSlugEdited(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
              </span>
            </label>
          </div>
          <p className={`t-footnote mt-1.5 px-1 ${error?.field === 'link' ? 'text-danger' : 'text-muted'}`} role={error?.field === 'link' ? 'alert' : undefined}>
            {error?.field === 'link' ? error.text : 'The name shows on the TV and on guests\u2019 phones. You can change it later'}
          </p>
        </section>

        <section>
          <h2 className="t-section">Guests</h2>
          <GuestListEditor
            names={guests.map((g) => ({ key: g, name: g }))}
            onAdd={(fresh) => {
              setGuests((g) => [...g, ...fresh]);
              return true;
            }}
            onRemove={(key) => {
              setGuests((g) => g.filter((x) => x !== key));
              return true;
            }}
          />
        </section>

        <section>
          <h2 className="t-section">{needsAdmin ? 'PINs' : 'Host PIN'}</h2>
          <div className="group">
            <label className={row}>
              <span className="flex-none">Host PIN</span>
              <input
                className={input}
                value={hostPin}
                inputMode="numeric"
                pattern="\d{4,6}"
                placeholder="4–6 digits"
                required
                onChange={(e) => setHostPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            {needsAdmin && (
              <label className={row}>
                <span className="flex-none">Admin PIN</span>
                <input className={input} type="password" value={adminPin} required placeholder="Required" onChange={(e) => setAdminPin(e.target.value)} />
              </label>
            )}
          </div>
          <div className="mt-1.5 space-y-1 px-1">
            <p className="t-footnote text-muted">
              {needsAdmin ? (
                <>
                  <span className="font-medium text-ink">Host PIN</span> unlocks the host remote for this party: play, skip, guests and settings
                </>
              ) : (
                'Make up 4 to 6 digits. They unlock the host remote for this party: play, skip, guests and settings'
              )}
            </p>
            {needsAdmin && (
              <p className="t-footnote text-muted">
                <span className="font-medium text-ink">Admin PIN</span> is this site&apos;s password, set by whoever runs the site. Only it can create parties
              </p>
            )}
          </div>
          {error?.field === 'pin' && (
            <p className="t-footnote mt-2 px-1 text-danger" role="alert">
              {error.text}
            </p>
          )}
        </section>

        <button
          type="submit"
          disabled={busy || !ready}
          className="press btn-primary min-h-12 w-full rounded-xl text-[1.0625rem] font-semibold"
        >
          {busy ? 'Creating…' : 'Create Party'}
        </button>
        {missing && <p className="t-footnote -mt-4 px-1 text-center text-muted">{missing}</p>}
      </form>
    </main>
  );
}
