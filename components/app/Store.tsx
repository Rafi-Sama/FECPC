"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Roster } from "@/lib/state";
import { earned, level } from "@/lib/xp";

// The member area's state lives on the server. This store holds the last copy the server sent,
// asks the server to make every change (`act`), and replaces its copy with the answer.
type Toast = { id: number; text: string; kind?: "big" | "bad" };
type Store = AppState & {
  xp: number;
  /** Ask the server to do something. Resolves true when it was done; a refusal is shown to the member. */
  act: (type: string, arg?: Record<string, unknown>) => Promise<boolean>;
  /** A member by id. People who have left still render, as their id. */
  who: (id: string) => Roster | { id: string; name: string; handle: string; rating: number };
};
const Ctx = createContext<Store>(null!);
const total = (st: AppState) => st.me.xp + earned(st.s) - st.s.spent;

export function StoreProvider({ initial, children }: { initial: AppState; children: React.ReactNode }) {
  const [st, setSt] = useState(initial);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notice, setNotice] = useState("");
  const n = useRef(0), seq = useRef(0), cur = useRef(st);
  cur.current = st;
  const toast = useCallback((text: string, kind?: Toast["kind"]) => { const id = ++n.current; setToasts((t) => [...t, { id, text, kind }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "bad" ? 5000 : 2600); }, []);
  // Answers can arrive out of order when the member clicks quickly; only the newest request may replace the state.
  const take = useCallback((mine: number, next: AppState) => { if (mine === seq.current) setSt(next); }, []);

  const act = useCallback<Store["act"]>(async (type, arg) => {
    const mine = ++seq.current, before = cur.current;
    try {
      const res = await fetch("/api/act", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...arg, type }) });
      if (res.status === 401) { location.href = "/login"; return false; }
      const j = await res.json();
      if (!res.ok || !j.state) { toast(j.error ?? "That did not work. Try again.", "bad"); return false; }
      const next: AppState = j.state, gain = earned(next.s) - earned(before.s); // every action that earns XP says so, immediately
      if (gain > 0) toast(`+${gain} XP`);
      if (level(total(next)).lv > level(total(before)).lv) toast(`LEVEL UP · ${level(total(next)).title}`, "big");
      if (j.info) setNotice(j.info);
      take(mine, next);
      return true;
    } catch { toast("You seem to be offline. Nothing was saved.", "bad"); return false; }
  }, [toast, take]);

  // Other people change things too (a payment gets verified, seats fill). Pick that up whenever the tab is looked at again.
  useEffect(() => {
    const sync = async () => {
      if (document.visibilityState !== "visible") return;
      const mine = ++seq.current;
      try { const res = await fetch("/api/state"); if (res.status === 401) location.href = "/login"; else if (res.ok) take(mine, (await res.json()).state); } catch {}
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [take]);

  const value = useMemo<Store>(() => {
    const byId = new Map(st.members.map((m) => [m.id, m]));
    return { ...st, xp: total(st), act, who: (id) => byId.get(id) ?? { id, name: id, handle: id, rating: 0 } };
  }, [st, act]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {notice && <Notice text={notice.replace(/\/login\?invite=\S+/, (path) => location.origin + path)} close={() => setNotice("")} />}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind ?? ""}`}>{t.text}</div>)}</div>
    </Ctx.Provider>
  );
}
// A one-time message from the server, usually an invite or reset link the officer has to pass on.
function Notice({ text, close }: { text: string; close: () => void }) {
  const [copied, setCopied] = useState(false), link = /https?:\/\/\S+/.exec(text)?.[0];
  return (
    <div className="notice t-b" role="alertdialog" aria-label="Notice">
      <p className="body" style={{ overflowWrap: "anywhere" }}>{text}</p>
      <div className="row" style={{ "--g": "8px" } as React.CSSProperties}>
        {link && <button className="btn sm" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))}>{copied ? "Copied ✓" : "Copy link"}</button>}
        <button className={`btn sm ${link ? "line" : ""}`} onClick={close}>Close</button>
      </div>
      {link && <p className="label">This link is shown once. If you lose it, create a new one under Admin → Members.</p>}
    </div>
  );
}
export const useStore = () => useContext(Ctx);
export const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
