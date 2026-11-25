'use client';
import { useState } from 'react';
import { api, ApiError } from '@/client/api';
import { CheckIcon, ChevronRightIcon, WarningIcon } from './Icons';

export interface SyncSummary {
  google: 'none' | 'ok' | 'expired' | 'unavailable';
  playlistUrl: string | null;
  synced: number;
  waiting: number;
  failed: number;
  pendingDeletes: number;
  quotaUsed: number;
}

/** FR-14 — backup playlist state as grouped rows: Connect / synced / N not synced + Retry / Reconnect. */
export function SyncStatus({ slug, sync, onChange }: { slug: string; sync: SyncSummary; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = `/api/google/connect?slug=${encodeURIComponent(slug)}`;
  const notSynced = sync.waiting + sync.failed + sync.pendingDeletes;

  if (sync.google === 'unavailable') return null; // this site has no Google login set up

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/e/${slug}/host/sync`, { body: {} });
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something broke.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="t-section">YouTube backup</h2>
      <div className="group">
        {sync.google === 'none' && (
          <a href={connect} className="group-row press text-accent-text">
            <span className="flex-1">Connect YouTube</span>
            <ChevronRightIcon className="text-faint" />
          </a>
        )}
        {sync.google === 'expired' && (
          <a href={connect} className="group-row press font-semibold text-danger">
            <WarningIcon />
            <span className="flex-1">Reconnect YouTube</span>
            <ChevronRightIcon className="text-faint" />
          </a>
        )}
        {sync.google === 'ok' && (
          <>
            <div className="group-row">
              {notSynced === 0 ? <CheckIcon className="text-ok" /> : <WarningIcon className="text-accent-text" />}
              <span className="flex-1">{notSynced === 0 ? 'All songs copied' : `${notSynced} not copied yet`}</span>
              <span className="text-muted">{sync.synced}</span>
            </div>
            {notSynced > 0 && (
              <button type="button" disabled={busy} onClick={retry} className="group-row press w-full text-left text-accent-text disabled:opacity-50">
                {busy ? 'Copying…' : 'Retry'}
              </button>
            )}
            {sync.playlistUrl && (
              <a href={sync.playlistUrl} target="_blank" rel="noreferrer" className="group-row press text-accent-text">
                <span className="flex-1">Open Playlist on YouTube</span>
                <ChevronRightIcon className="text-faint" />
              </a>
            )}
          </>
        )}
      </div>
      <p className={`t-footnote mt-1.5 px-1 ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
        {error ??
          (sync.google === 'none'
            ? 'Copies every song to a playlist on your account, so you can cast it from the YouTube app if the TV page fails'
            : `YouTube checks used today: ${sync.quotaUsed.toLocaleString()} of 10,000`)}
      </p>
    </section>
  );
}
