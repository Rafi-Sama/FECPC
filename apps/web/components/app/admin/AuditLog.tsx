'use client';
// Admin → Audit log: every recorded action, newest first, by section, searchable, a day at a glance.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIT_AREAS, type AuditArea, type AuditEntry, type AuditPage } from '@fecpc/contracts';
import { site } from '@/lib/site';

const HUE: Record<AuditArea, string> = {
  Recruitment: '#1f3bff',
  'Members & roles': '#7a2fd0',
  Finance: '#1a7f37',
  Events: '#c2410c',
  Community: '#d4a72c',
  Workspace: '#0e7490',
  Training: '#b91c1c',
  Alumni: '#5e5a50',
  Email: '#0d9488',
  'Security & settings': 'var(--ink)',
  Other: '#8a857a',
};
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: site.tz });
const dayLabel = (key: string) => {
  const today = dayKey(new Date().toISOString()),
    yesterday = dayKey(new Date(Date.now() - 864e5).toISOString());
  return key === today
    ? 'Today'
    : key === yesterday
      ? 'Yesterday'
      : new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
};
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: site.tz,
  });

export function AuditLog() {
  const [area, setArea] = useState<AuditArea | null>(null);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [counts, setCounts] = useState<AuditPage['counts']>({});
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  // Only the latest request may fill the list: an older, slower answer arriving later is dropped.
  const reqSeq = useRef(0);
  const load = useCallback(
    async (before?: string) => {
      const mine = ++reqSeq.current;
      setBusy(true);
      setErr('');
      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'list', area, q: query, before }),
        });
        const j = await res.json();
        if (mine !== reqSeq.current) return;
        if (!res.ok) throw new Error(j.error ?? 'The log could not be loaded.');
        const page = j as AuditPage;
        setRows((r) => (before ? [...r, ...page.rows] : page.rows));
        setCounts(page.counts);
        setMore(page.more);
      } catch (e) {
        if (mine === reqSeq.current) setErr((e as Error).message);
      } finally {
        if (mine === reqSeq.current) setBusy(false);
      }
    },
    [area, query],
  );
  useEffect(() => void load(), [load]);
  // Search as you type, a moment after the last key.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const total = Object.values(counts).reduce((a, n) => a + (n ?? 0), 0);
  const days: [string, AuditEntry[]][] = [];
  for (const r of rows) {
    const k = dayKey(r.at);
    if (days.at(-1)?.[0] === k) days.at(-1)![1].push(r);
    else days.push([k, [r]]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div
          className="al-areas flex flex-wrap gap-1.5 flex-[1_1_520px]"
          role="tablist"
          aria-label="Sections"
        >
          <button
            role="tab"
            aria-selected={!area}
            className={!area ? 'on' : ''}
            onClick={() => setArea(null)}
          >
            All <b>{total}</b>
          </button>
          {AUDIT_AREAS.filter((a) => counts[a]).map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={area === a}
              className={area === a ? 'on' : ''}
              style={{ '--h': HUE[a] } as React.CSSProperties}
              onClick={() => setArea(a)}
            >
              <i aria-hidden />
              {a} <b>{counts[a]}</b>
            </button>
          ))}
        </div>
        <input
          className="input sm"
          type="search"
          placeholder="Search who or what"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the audit log"
        />
      </div>
      <p className="text-dim text-[14px]">Entries can't be edited or deleted, by anyone.</p>

      {err && (
        <p className="body bad" role="alert">
          {err}
        </p>
      )}
      {!busy && !err && rows.length === 0 && (
        <p className="p-8 text-center [color:var(--dim)] [border:1px_dashed_var(--line)]">
          {query ? 'Nothing matches that search.' : 'Nothing recorded here yet.'}
        </p>
      )}
      {days.map(([k, list]) => (
        <section
          key={k}
          className="[&_li+li]:[border-top:1px_solid_var(--line)] [&_ol]:[display:grid] [&_ol]:[border:1px_solid_var(--line)] [&_ol]:[background:var(--panel)] [&_li]:[display:grid] [&_li]:grid-cols-[52px_minmax(0,1fr)_auto] [&_li]:gap-3 [&_li]:items-baseline [&_li]:p-[10px_14px_10px_12px] [&_li]:[border-left:4px_solid_var(--h)] [&_li]:text-[15px] [&_time]:[font:14px_var(--f-label)] [&_time]:[color:var(--dim)] max-[641px]:[&_li]:grid-cols-[44px_minmax(0,1fr)]"
        >
          <h3 className="mb-2 [font:600_14px/1_var(--f-label)] text-mut uppercase tracking-[0.08em]">
            {dayLabel(k)}
          </h3>
          <ol>
            {list.map((r) => (
              <li key={r.id} style={{ '--h': HUE[r.area] ?? HUE.Other } as React.CSSProperties}>
                <time dateTime={r.at}>{time(r.at)}</time>
                <span className="[overflow-wrap:anywhere]">
                  <b>{r.who}</b> {r.what}
                </span>
                {!area && (
                  <span className="[font:14px_var(--f-label)] [color:var(--h)] whitespace-nowrap max-[641px]:col-[2]">
                    {r.area}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {more && (
        <button
          className="btn sm line self-center"

          disabled={busy}
          onClick={() => load(rows.at(-1)?.id)}
        >
          {busy ? 'Loading…' : 'Load older'}
        </button>
      )}
    </div>
  );
}
