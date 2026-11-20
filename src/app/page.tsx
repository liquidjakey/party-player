// Design Ref: §5.4 Admin — create a reusable event (FR-01). iOS grouped form.
'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/client/api';
import { CheckIcon, ChevronRightIcon, LinkIcon, MusicIcon, TvIcon } from '@/components/Icons';

const DEFAULT_GUESTS = ['Maya', 'Daniel', 'Priya', 'Marcus', 'Sofia', 'Kenji', 'Olivia'].join('\n');
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function AdminPage() {
  const [name, setName] = useState('Thanksgiving');
  const [slug, setSlug] = useState('thanksgiving');
  const [slugEdited, setSlugEdited] = useState(false);
  const [guests, setGuests] = useState(DEFAULT_GUESTS);
  const [hostPin, setHostPin] = useState('');
  const [region, setRegion] = useState('KR');
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const guestCount = guests.split('\n').filter((g) => g.trim()).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ slug: string }>('/api/events', {
        body: {
          adminPin,
          name: name.trim(),
          slug,
          guests: guests.split('\n').map((g) => g.trim()).filter(Boolean),
          hostPin,
          region,
        },
      });
      setCreated(res.slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something broke. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const links = [
      { label: 'Guests', note: 'Share this link', path: `/e/${created}`, icon: <LinkIcon />, tint: 'bg-accent text-accent-ink' },
      { label: 'TV', note: 'Open on the projector', path: `/e/${created}/tv`, icon: <TvIcon />, tint: 'bg-cocoa text-white' },
      { label: 'Host remote', note: 'Your phone', path: `/e/${created}/host`, icon: <MusicIcon />, tint: 'bg-cranberry text-white' },
    ];
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[max(4rem,env(safe-area-inset-top))] pb-12">
        <div className="materialize text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-ok text-3xl text-white"><CheckIcon /></span>
          <h1 className="t-large mt-4">Party Created</h1>
          <p className="mt-2 text-muted">Keep these links. The host PIN unlocks the remote.</p>
        </div>
        <ul className="group mt-8">
          {links.map((l) => (
            <li key={l.path}>
              <Link href={l.path} className="group-row press">
                <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${l.tint}`}>{l.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block">{l.label}</span>
                  <span className="t-footnote block truncate text-muted">
                    {origin}
                    {l.path}
                  </span>
                </span>
                <ChevronRightIcon className="flex-none text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const row = 'group-row';
  const input = 'min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint';
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-16">
      <div className="arrive mb-8">
        <p className="t-footnote font-medium text-muted">Party Playlist</p>
        <h1 className="t-large mt-1">New Party</h1>
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
                  className="min-w-0 bg-transparent text-ink outline-none"
                  style={{ width: `${Math.max(slug.length, 4)}ch` }}
                  value={slug}
                  required
                  pattern="[a-z0-9-]{2,40}"
                  autoCapitalize="off"
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
              </span>
            </label>
            <label className={row}>
              <span className="flex-none">Country</span>
              <select className={`${input} appearance-none text-muted`} value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="KR">Korea</option>
                <option value="US">United States</option>
                <option value="JP">Japan</option>
                <option value="GB">United Kingdom</option>
              </select>
              <ChevronRightIcon className="flex-none rotate-90 text-faint" />
            </label>
          </div>
          <p className="t-footnote mt-1.5 px-4 text-muted">Songs blocked in this country are refused</p>
        </section>

        <section>
          <h2 className="t-section">Guests · {guestCount}</h2>
          <div className="group">
            <textarea
              className="block min-h-44 w-full resize-y bg-transparent px-4 py-3 outline-none placeholder:text-faint"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              placeholder="One name per line"
            />
          </div>
          <p className="t-footnote mt-1.5 px-4 text-muted">One name per line. You can edit them later on the host page.</p>
        </section>

        <section>
          <h2 className="t-section">PINs</h2>
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
            <label className={row}>
              <span className="flex-none">Admin PIN</span>
              <input className={input} type="password" value={adminPin} required placeholder="Required" onChange={(e) => setAdminPin(e.target.value)} />
            </label>
          </div>
          <p className={`t-footnote mt-1.5 px-4 ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
            {error ?? 'The host PIN unlocks the remote for this party'}
          </p>
        </section>

        <button
          type="submit"
          disabled={busy}
          className="press btn-primary min-h-12 w-full rounded-xl text-[1.0625rem] font-semibold"
        >
          {busy ? 'Creating…' : 'Create Party'}
        </button>
      </form>
    </main>
  );
}
