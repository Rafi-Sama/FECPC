'use client';
import { SaveForm } from '@/components/app/SaveBar';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from './Store';

export type Judge = {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string;
  history: number[];
  solved: string[];
  tags: Record<string, number>;
  days: Record<string, number>;
};
const cache = new Map<string, Judge>();

/** Live Codeforces data for the linked handle, or null while unlinked/loading. */
export function useJudge() {
  const { s, syncJudges } = useStore();
  const [data, setData] = useState<Judge | null>(cache.get(s.handle) ?? null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!s.handle) {
      setData(null);
      return;
    }
    if (cache.has(s.handle)) {
      setData(cache.get(s.handle)!);
      return;
    }
    let live = true;
    setBusy(true);
    setErr('');
    fetch(`/api/cf/${encodeURIComponent(s.handle)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!live) return;
        if (!r.ok) {
          setErr(j.error);
          setData(null);
        } else {
          cache.set(s.handle, j);
          setData(j);
          // Let the server record the member's own stats and milestones. It fetches Codeforces itself.
          void syncJudges();
        }
      })
      .catch(() => live && setErr('Could not reach the server.'))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [s.handle, syncJudges]);
  return { data, err, busy };
}

/** Solved = ticked by hand or accepted on Codeforces. `synced` problems cannot be unticked. */
export function useSolved() {
  const { s } = useStore();
  const { data } = useJudge();
  return useMemo(() => {
    const synced = new Set(data?.solved ?? []);
    const ticked = new Set(s.solved);
    return { synced, isSolved: (id: string) => synced.has(id) || ticked.has(id) };
  }, [data, s.solved]);
}

export function HandleBox() {
  const { s, act } = useStore();
  const { data, err, busy } = useJudge();
  const [v, setV] = useState('');
  if (s.handle && !err)
    return (
      <p className="body" aria-live="polite">
        {busy ? (
          `syncing ${s.handle} from Codeforces…`
        ) : data ? (
          <>
            linked: <strong className="acc">{data.handle}</strong> · {data.rank} {data.rating} ·{' '}
            {data.solved.length} solved · synced from Codeforces
          </>
        ) : null}{' '}
        <button className="link sample" onClick={() => act('handle', { value: '' })}>
          unlink
        </button>
      </p>
    );
  return (
    <SaveForm
      className="row"
      style={{ '--g': '10px', alignItems: 'flex-end' } as React.CSSProperties}
      label="Codeforces handle not linked yet"
      saveLabel="Link handle"
      onDiscard={() => setV('')}
      onSubmit={async () => {
        const ok = await act('handle', { value: v.trim() });
        if (ok) setV('');
        return ok;
      }}
    >
      <label className="field" style={{ flex: '0 1 260px' }}>
        <span className="label">Codeforces handle</span>
        <input
          className="input"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="your_handle"
          pattern="[\w.\-]{3,24}"
          title="3 to 24 letters, digits, _ . or -"
          required
        />
      </label>
      {err && (
        <p className="body bad" role="alert" style={{ flexBasis: '100%' }}>
          {err}{' '}
          <button
            type="button"
            className="link sample"
            onClick={() => act('handle', { value: '' })}
          >
            clear
          </button>
        </p>
      )}
    </SaveForm>
  );
}

/** The linked VJudge account. The server fetches its solves; they count toward XP like Codeforces ones. */
export function VjudgeBox() {
  const { s, act, syncJudges } = useStore();
  const [v, setV] = useState('');
  if (s.vjudge)
    return (
      <p className="body">
        VJudge: <strong className="acc">{s.vjudge}</strong> · {s.vjSolved} solved outside Codeforces{' '}
        <button className="link sample" onClick={() => act('vjudge', { value: '' })}>
          unlink
        </button>
      </p>
    );
  return (
    <SaveForm
      className="row"
      style={{ '--g': '10px', alignItems: 'flex-end' } as React.CSSProperties}
      label="VJudge username not linked yet"
      saveLabel="Link username"
      onDiscard={() => setV('')}
      onSubmit={async () => {
        // Link, then let the server fetch the solves; syncJudges reloads state so the count and XP show.
        const ok = await act('vjudge', { value: v.trim() });
        if (ok) {
          setV('');
          await syncJudges();
        }
        return ok;
      }}
    >
      <label className="field" style={{ flex: '0 1 260px' }}>
        <span className="label">VJudge username</span>
        <input
          className="input"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="your_username"
          pattern="[\w.\-]{2,30}"
          title="2 to 30 letters, digits, _ . or -"
          required
        />
      </label>
    </SaveForm>
  );
}
