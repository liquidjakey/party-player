'use client';
import { useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { MinusCircleIcon, PlusIcon } from './Icons';

/**
 * Add guests one at a time: type a name → Add (or Enter). Pasting "Maya, Daniel" or one name per line adds all.
 * Removing is two steps (red minus → Remove), like the song list. The typed name is kept if adding fails.
 */
export function GuestListEditor({
  names,
  onAdd,
  onRemove,
  canRemove = () => true,
  removeNote,
}: {
  names: { key: string; name: string; color?: number | null }[];
  onAdd: (names: string[]) => boolean | Promise<boolean>;
  onRemove: (key: string, name: string) => boolean | Promise<boolean>;
  canRemove?: (key: string) => boolean;
  removeNote?: string;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function add(raw: string) {
    if (adding) return;
    const parts = raw
      .split(/[\n,]+/)
      .map((n) => n.trim().slice(0, 30))
      .filter(Boolean);
    if (parts.length === 0) return;
    const taken = new Set(names.map((n) => n.name.toLowerCase()));
    const fresh = [...new Set(parts)].filter((n) => !taken.has(n.toLowerCase()));
    if (fresh.length === 0) {
      setError(parts.length === 1 ? `${parts[0]} is already on the list` : 'Those names are already on the list');
      return;
    }
    setError(null);
    setAdding(true);
    const ok = await onAdd(fresh);
    setAdding(false);
    if (ok) {
      setText('');
      inputRef.current?.focus();
    }
  }

  return (
    <div className="space-y-2">
      <div className="group">
        {/* Not a <form>: on the New Party page this sits inside the party form */}
        <div className="group-row tight">
          <PlusIcon className="flex-none text-[1.25rem] text-accent-text" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              // isComposing: Enter that only finishes a Korean/Japanese letter must not add the name
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              add(text);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (/[\n,]/.test(pasted)) {
                e.preventDefault();
                add(pasted);
              }
            }}
            maxLength={200}
            placeholder="Type a guest's name"
            aria-label="Guest name"
            autoCapitalize="words"
            enterKeyHint="done"
            className="min-h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
          />
          <button type="button" onClick={() => add(text)} disabled={!text.trim() || adding} className="press -mr-2 min-h-11 px-2 font-semibold text-accent-text disabled:opacity-30">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {names.map((g) => {
          const open = confirming === g.key;
          const going = removing === g.key;
          return (
            <div key={g.key} className={`group-row arrive transition-opacity duration-200 ${going ? 'pointer-events-none opacity-40' : ''}`}>
              {canRemove(g.key) ? (
                <button
                  type="button"
                  aria-label={open ? 'Cancel' : `Remove ${g.name}`}
                  aria-expanded={open}
                  onClick={() => setConfirming(open ? null : g.key)}
                  className={`press hit -ml-1 grid h-8 w-8 flex-none place-items-center text-[1.375rem] text-danger transition-transform duration-200 ${
                    open ? 'rotate-90' : ''
                  }`}
                >
                  <MinusCircleIcon />
                </button>
              ) : null}
              <Avatar name={g.name} size={28} />
              <span className="flex-1 truncate">{g.name}</span>
              {open && (
                <button
                  type="button"
                  onClick={async () => {
                    setConfirming(null);
                    setRemoving(g.key);
                    await onRemove(g.key, g.name);
                    setRemoving(null);
                  }}
                  className="press materialize min-h-11 flex-none rounded-lg bg-danger px-3 text-[0.9375rem] font-semibold text-white"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className={`t-footnote px-1 ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
        {error ??
          (names.length === 0
            ? 'Add everyone who is coming, including yourself if you want to add songs. You can paste a list separated by commas'
            : removeNote ?? `${names.length} ${names.length === 1 ? 'guest' : 'guests'}`)}
      </p>
    </div>
  );
}
