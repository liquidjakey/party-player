'use client';
import { useState } from 'react';
import { PlusIcon } from './Icons';

/** One field (paste a YouTube link) + one filled button. Inline validation under the field. */
export function AddSongBox({
  onSubmit,
  initial = '',
}: {
  onSubmit: (text: string) => Promise<string | null>;
  initial?: string;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(v);
    setBusy(false);
    if (err) setError(err);
    else setText('');
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
        className="press flex min-h-12 w-full items-center justify-center gap-1.5 btn-primary rounded-xl px-4 text-[1.0625rem] font-semibold"
      >
        {busy ? (
          'Checking…'
        ) : (
          <>
            <PlusIcon /> Add Song
          </>
        )}
      </button>
      <p id="add-song-help" role={error ? 'alert' : undefined} className={`t-footnote px-1 ${error ? 'text-danger' : 'text-muted'}`}>
        {error ?? 'In YouTube or YouTube Music, tap Share → Copy link, then paste it here'}
      </p>
    </form>
  );
}
