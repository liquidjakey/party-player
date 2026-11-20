'use client';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { MinusCircleIcon, PlusIcon } from './Icons';

/**
 * Add guests one at a time: type a name → Add (or Enter). Each name shows as a row with a remove button.
 * Pasting "Maya, Daniel, Priya" or one name per line adds them all at once.
 */
export function GuestListEditor({
  names,
  onAdd,
  onRemove,
  canRemove = () => true,
  removeNote,
}: {
  names: { key: string; name: string }[];
  onAdd: (names: string[]) => void;
  onRemove: (key: string, name: string) => void;
  canRemove?: (key: string) => boolean;
  removeNote?: string;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function add(raw: string) {
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
    onAdd(fresh);
    setText('');
  }

  return (
    <div className="space-y-2">
      <div className="group">
        <form
          className="group-row py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            add(text);
          }}
        >
          <PlusIcon className="flex-none text-[1.25rem] text-accent" />
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
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
            className="min-h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
          />
          <button type="submit" disabled={!text.trim()} className="press font-semibold text-accent disabled:opacity-30">
            Add
          </button>
        </form>
        {names.map((g) => (
          <div key={g.key} className="group-row arrive">
            <Avatar name={g.name} size={28} />
            <span className="flex-1 truncate">{g.name}</span>
            {canRemove(g.key) && (
              <button
                type="button"
                aria-label={`Remove ${g.name}`}
                onClick={() => onRemove(g.key, g.name)}
                className="press text-[1.375rem] text-danger"
              >
                <MinusCircleIcon />
              </button>
            )}
          </div>
        ))}
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
