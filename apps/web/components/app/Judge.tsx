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
  /** when each rating in `history` was set (ms) */
  historyAt: number[];
  solved: string[];
  tags: Record<string, number>;
  days: Record<string, number>;
  /** The last three rated rounds, newest first, with every problem in them. */
  contests: {
    id: number;
    name: string;
    rank: number;
    delta: number;
    at: number;
    problems: { id: string; index: string; name: string; rating: number | null }[];
  }[];
};
const cache = new Map<string, Judge>();
const listeners = new Set<() => void>();
// Several widgets on one page ask for the same handle at once; they share one request.
const inflight = new Map<
  string,
  Promise<{ ok: boolean; j: Judge & { error?: string }; first: boolean }>
>();
function load(handle: string) {
  const known = inflight.get(handle);
  if (known) return known.then((x) => ({ ...x, first: false }));
  const p = fetch(`/api/cf/${encodeURIComponent(handle)}`)
    .then(async (r) => ({ ok: r.ok, j: await r.json(), first: true }))
    .finally(() => inflight.delete(handle));
  inflight.set(handle, p);
  return p;
}

/** Asks Codeforces again, past the cache; every useJudge() picks up the new data. Null when it did not answer. */
export async function recheck(handle: string): Promise<Judge | null> {
  const r = await fetch(`/api/cf/${encodeURIComponent(handle)}?fresh=1`).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json()) as Judge;
  cache.set(handle, j);
  listeners.forEach((f) => f());
  return j;
}

/** Live Codeforces data for the linked handle, or null while unlinked/loading. */
export function useJudge() {
  const { s, syncJudges } = useStore();
  const [data, setData] = useState<Judge | null>(cache.get(s.handle) ?? null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const f = () => setData(cache.get(s.handle) ?? null);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, [s.handle]);
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
    load(s.handle)
      .then(({ ok, j, first }) => {
        if (ok) cache.set(s.handle, j);
        // Let the server record the member's own stats and milestones. It fetches Codeforces itself.
        if (ok && first) void syncJudges();
        if (!live) return;
        if (!ok) {
          setErr(j.error ?? 'Codeforces did not answer.');
          setData(null);
        } else setData(j);
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
  // Linked once; after that it changes through a profile request (Secretary or President approves).
  if (s.handle)
    return (
      <p className={`body${err ? ' bad' : ''}`} aria-live="polite">
        {busy ? (
          `syncing ${s.handle} from Codeforces…`
        ) : data ? (
          <>
            linked: <strong className="acc">{data.handle}</strong> · {data.rank} {data.rating} ·{' '}
            {data.solved.length} solved · synced from Codeforces
          </>
        ) : (
          <>
            <strong>{s.handle}</strong>: {err} Request a change from your profile.
          </>
        )}
      </p>
    );
  return (
    <SaveForm
      className="row [--g:10px] items-end"
      label="Codeforces handle not linked yet"
      saveLabel="Link handle"
      onDiscard={() => setV('')}
      onSubmit={async () => {
        const ok = await act('handle', { value: v.trim() });
        if (ok) setV('');
        return ok;
      }}
    >
      <label className="field flex-[0_1_260px]">
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
      <button type="submit" className="btn sm">
        Link handle
      </button>
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
        VJudge: <strong className="acc">{s.vjudge}</strong> · {s.vjSolved} solved outside Codeforces
      </p>
    );
  return (
    <SaveForm
      className="row [--g:10px] items-end"
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
      <label className="field flex-[0_1_260px]">
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
      <button type="submit" className="btn sm">
        Link username
      </button>
    </SaveForm>
  );
}
