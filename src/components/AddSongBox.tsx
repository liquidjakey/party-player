'use client';
import { useRef, useState } from 'react';
import { CheckIcon, PlusIcon } from './Icons';

/**
 * One field (paste a YouTube link) + one filled button. Errors show under the field.
 * On success the keyboard closes and the confirmation shows right here, where the guest is looking
 * (a bottom toast would sit under the keyboard).
 */
export function AddSongBox({ onSubmit }: { onSubmit: (text: string) => Promise<{ error: string } | { title: string }> }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function submit() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    const res = await onSubmit(v);
    setBusy(false);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setText('');
    field.current?.blur();
    setAdded(res.title);
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setAdded(null), 4000);
  }

  return (
    <form
      aria-label="Add a song"
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={field}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Paste a YouTube link"
        inputMode="url"
        enterKeyHint="send"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby="add-song-help"
        className={`block w-full resize-none rounded-xl bg-surface px-4 py-3 text-[1.0625rem] outline-none ring-1 transition-shadow placeholder:text-faint focus:ring-2 focus:ring-accent ${
          error ? 'ring-2 ring-danger' : 'ring-line'
        }`}
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="press btn-primary flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-[1.0625rem] font-semibold"
      >
        {busy ? (
          'Checking…'
        ) : (
          <>
            <PlusIcon /> Add Song
          </>
        )}
      </button>
      <p
        id="add-song-help"
        role={error ? 'alert' : 'status'}
        className={`t-footnote flex items-start gap-1 px-1 ${error ? 'text-danger' : added ? 'font-medium text-ok' : 'text-muted'}`}
      >
        {/* A new message rises in; the help text comes back without motion */}
        <span key={error ? `e:${error}` : added ? `a:${added}` : 'help'} className={`flex items-start gap-1 ${error || added ? 'swap-in' : ''}`}>
          {added && !error && <CheckIcon className="mt-px flex-none" />}
          <span className="line-clamp-2">{error ?? (added ? `Added “${added}”` : 'In YouTube or YouTube Music, tap Share → Copy link, then paste it here')}</span>
        </span>
      </p>
    </form>
  );
}
