'use client';
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AppState, MilestoneDTO, Roster } from '@fecpc/contracts';
import { earned, level, xpRates } from '@fecpc/contracts';

import { toastStack } from '@/components/app/shared/ui';
import { SAVE_ERROR_EVENT } from '@/components/app/SaveBar';

// The member area's state lives on the server. This store holds the last copy the server sent,
// asks the server to make every change (`act`), and replaces its copy with the answer.
type Toast = { id: number; text: string; kind?: 'big' | 'bad' };
type Store = AppState & {
  xp: number;
  recentMilestones: MilestoneDTO[];
  /** Give one permanent kudos on a milestone, with optimistic update + rollback. */
  giveKudos: (milestoneId: number) => Promise<void>;
  /** Ask the server to do something. Resolves true when it was done; a refusal is shown to the member. */
  act: (type: string, arg?: Record<string, unknown>) => Promise<boolean>;
  /** Has the server pull the member's Codeforces and VJudge stats, then reloads state so new XP shows. */
  syncJudges: () => Promise<void>;
  /** A short message at the bottom of the screen; `bad` for errors. */
  toast: (text: string, kind?: 'bad' | 'big') => void;
  /** A member by id. People who have left still render, as their id. */
  who: (id: string) => Roster | { id: string; name: string; handle: string; rating: number };
};
const Ctx = createContext<Store>(null!);
const total = (st: AppState) => st.me.xp + earned(st.s, xpRates(st.s.kv));

export function StoreProvider({
  initial,
  children,
}: {
  initial: AppState;
  children: React.ReactNode;
}) {
  const [st, setSt] = useState(initial);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notice, setNotice] = useState('');
  const n = useRef(0),
    seq = useRef(0),
    cur = useRef(st);
  cur.current = st;
  const toast = useCallback((text: string, kind?: Toast['kind']) => {
    const id = ++n.current;
    setToasts((t) => [...t, { id, text, kind }]);
    // A failure while the save bar is up is that save's failure: the bar says it too.
    if (kind === 'bad') window.dispatchEvent(new CustomEvent(SAVE_ERROR_EVENT, { detail: text }));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'bad' ? 5000 : 2600);
  }, []);
  // The roster grows with the club, so it is not in the page or in state answers. It loads after the page and is
  // revalidated (ETag, usually a 304) whenever new state arrives; unchanged, it is not parsed again.
  const [members, setMembers] = useState<Roster[]>(initial.members);
  const rosterTag = useRef<string | null>(null);
  const roster = useCallback(async () => {
    try {
      const res = await fetch('/api/roster');
      const tag = res.headers.get('etag');
      if (!res.ok || (tag && tag === rosterTag.current)) return;
      rosterTag.current = tag;
      const next = ((await res.json()) as { members: Roster[] }).members;
      // Every screen reads the store, so this re-render is big: a transition lets React split it up.
      startTransition(() => setMembers(next));
    } catch {}
  }, []);
  useEffect(() => {
    // After the page has painted, so the roster never competes with the first view.
    const go = () => void roster();
    if (document.readyState !== 'complete') addEventListener('load', go, { once: true });
    else setTimeout(go, 0);
    return () => removeEventListener('load', go);
  }, [roster]);
  // Answers can arrive out of order when the member clicks quickly; only the newest request may replace the state.
  const take = useCallback(
    (mine: number, next: AppState) => {
      if (mine !== seq.current) return;
      setSt(next);
      void roster();
    },
    [roster],
  );

  const act = useCallback<Store['act']>(
    async (type, arg) => {
      const mine = ++seq.current,
        before = cur.current;
      try {
        const res = await fetch('/api/act', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...arg, type }),
        });
        if (res.status === 401) {
          location.href = '/login';
          return false;
        }
        const j = await res.json();
        if (!res.ok || !j.state) {
          toast(j.error ?? 'That did not work. Try again.', 'bad');
          return false;
        }
        const next: AppState = j.state,
          gain = total(next) - total(before); // every action that earns XP says so, immediately
        if (gain > 0) toast(`+${gain} XP`);
        if (level(total(next)).lv > level(total(before)).lv)
          toast(`LEVEL UP · ${level(total(next)).title}`, 'big');
        if (j.info) setNotice(j.info);
        take(mine, next);
        return true;
      } catch {
        toast('You seem to be offline. Nothing was saved.', 'bad');
        return false;
      }
    },
    [toast, take],
  );

  const giveKudos = useCallback<Store['giveKudos']>(
    async (milestoneId) => {
      const before = cur.current;
      const target = (before.counts.recentMilestones ?? []).find((m) => m.id === milestoneId);
      if (!target || target.has_kudos || target.user_id === before.me.id || before.me.system)
        return;
      const mine = ++seq.current;
      // Optimistically flip row to Kudos ✓ and increment the milestone's count
      setSt((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          recentMilestones: (prev.counts.recentMilestones ?? []).map((m) =>
            m.id === milestoneId ? { ...m, has_kudos: true, kudos_count: m.kudos_count + 1 } : m,
          ),
        },
      }));

      const rollback = (serverState?: AppState | null) => {
        if (serverState) {
          take(mine, serverState);
          return;
        }
        setSt((prev) => ({
          ...prev,
          counts: {
            ...prev.counts,
            recentMilestones: (prev.counts.recentMilestones ?? []).map((m) =>
              m.id === milestoneId
                ? { ...m, has_kudos: false, kudos_count: Math.max(0, m.kudos_count - 1) }
                : m,
            ),
          },
        }));
      };

      try {
        const res = await fetch('/api/community', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'kudosMilestone', milestoneId }),
        });
        if (res.status === 401) {
          location.href = '/login';
          return;
        }
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          reason?: string;
          state?: AppState;
        };
        if (!res.ok || j.ok === false) {
          rollback(j.state);
          toast('KUDOS FAILED. TRY AGAIN.', 'bad');
          return;
        }
        if (j.state) take(mine, j.state);
      } catch {
        rollback();
        toast('KUDOS FAILED. TRY AGAIN.', 'bad');
      }
    },
    [toast, take],
  );

  // Other people change things too (a payment gets verified, seats fill). Pick that up whenever the tab is looked at again,
  // and every few minutes while it is.
  useEffect(() => {
    const sync = async () => {
      if (document.visibilityState !== 'visible') return;
      const mine = ++seq.current;
      try {
        const res = await fetch('/api/state');
        if (res.status === 401) location.href = '/login';
        else if (res.ok) take(mine, (await res.json()).state);
      } catch {}
    };
    document.addEventListener('visibilitychange', sync);
    // A tab left open still sees new notifications; three minutes keeps serverless calls rare.
    const t = setInterval(sync, 180_000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      clearInterval(t);
    };
  }, [take]);

  const syncJudges = useCallback(async () => {
    try {
      const r = await fetch('/api/codeforces/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!r.ok || !(await r.json()).synced) return;
      const mine = ++seq.current,
        res = await fetch('/api/state');
      if (res.ok) take(mine, (await res.json()).state);
    } catch {}
  }, [take]);
  // Judge stats feed XP, so they are refreshed once per visit (the server allows one sync a minute).
  useEffect(() => {
    void syncJudges();
  }, [syncJudges]);

  const value = useMemo<Store>(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    return {
      ...st,
      members,
      xp: total(st),
      recentMilestones: st.counts.recentMilestones ?? [],
      giveKudos,
      act,
      syncJudges,
      toast,
      who: (id) => byId.get(id) ?? { id, name: id, handle: id, rating: 0 },
    };
  }, [st, members, act, giveKudos, syncJudges, toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {notice && (
        <Notice
          text={notice.replace(/\/login\?invite=\S+/g, (path) => location.origin + path)}
          close={() => setNotice('')}
        />
      )}
      <div className={toastStack} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind ?? ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
// A one-time message from the server, usually an invite or reset link the officer has to pass on.
function Notice({ text, close }: { text: string; close: () => void }) {
  const [copied, setCopied] = useState(false),
    links = text.match(/https?:\/\/\S+/g) ?? [],
    link = links.length > 1 ? text : links[0]; // several links (a bulk accept): copy the whole list
  return (
    <div
      className="fixed inset-[auto_16px_16px_auto] z-60 w-[min(440px,calc(100vw_-_32px))] flex flex-col gap-3 items-start p-5 [border:2px_solid_var(--ink)] [box-shadow:0_12px_32px_rgba(0,0,0,0.35)] max-[861px]:bottom-19 t-b"
      role="alertdialog"
      aria-label="Notice"
    >
      <p className="body [overflow-wrap:anywhere] whitespace-pre-line">{text}</p>
      <div className="row [--g:8px]">
        {link && (
          <button
            className="btn sm"
            onClick={() =>
              navigator.clipboard.writeText(link).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }
          >
            {copied ? 'Copied ✓' : links.length > 1 ? 'Copy all' : 'Copy link'}
          </button>
        )}
        <button className={`btn sm ${link ? 'line' : ''}`} onClick={close}>
          Close
        </button>
      </div>
      {link && (
        <p className="label">
          This link is shown once. If you lose it, create a new one under Admin → Members.
        </p>
      )}
    </div>
  );
}
export const useStore = () => useContext(Ctx);
export const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
