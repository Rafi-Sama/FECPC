'use client';
import Link from 'next/link';
import { useStore } from '@/components/app/Store';
import { rankFor } from '@fecpc/contracts';

const tk = (n: number) => '৳' + Math.round(n).toLocaleString('en-US');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const css = (o: Record<string, string | number>) => o as React.CSSProperties;

/** Horizontal bars, one row per label. */
function Rows({ rows }: { rows: [string, number, string?][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="list">
      {rows.map(([l, n, color]) => (
        <li key={l}>
          <span style={{ minWidth: 120 }}>{l}</span>
          <span className="grow meter" style={css({ '--v': `${(n / max) * 100}%` })}>
            <i style={color ? { background: color } : undefined} />
          </span>
          <b className="mono" style={{ minWidth: 32, textAlign: 'right' }}>
            {n}
          </b>
        </li>
      ))}
    </ul>
  );
}

/** The executive overview, counted from the live state payload. A role only sees what it can act on. */
export function Dashboard({ go, exp }: { go: (tab: string) => void; exp: boolean }) {
  const { members, office, term, fundTotal, counts } = useStore();
  const people = members.filter((m) => m.id !== 'admin' && !m.is_alumni);
  const active = people.filter((m) => !m.suspended && !m.pending);
  const linked = active.filter((m) => m.cf_handle);
  const rated = linked
    .map((m) => m.cf_rating ?? 0)
    .filter((r) => r > 0)
    .sort((a, b) => a - b);
  const median = rated.length ? rated[Math.floor(rated.length / 2)]! : 0;
  const daily = active.filter((m) => (m.current_streak ?? m.streak) > 0).length;
  const today = new Date().toLocaleDateString('en-CA');

  const todo: [number, string, string | (() => void)][] = [
    [
      (office.recruit?.applicants ?? []).filter((a) => a.status === 'pending').length,
      'applications to decide',
      () => go('Recruit'),
    ],
    [office.profileRequests?.length ?? 0, 'profile changes to review', () => go('Requests')],
    [
      (office.queue ?? []).filter((q) => q.status === 'pending' && !q.mine).length,
      'payments to verify',
      '/app/finance#Payments',
    ],
    [
      (office.expenses ?? []).filter(
        (e) => e.status === 'pending' || e.status === 'sent to President',
      ).length,
      'expenses to decide',
      '/app/finance#Expenses',
    ],
    [office.mail?.failed.length ?? 0, 'emails failed to send', () => go('Recruit')],
    [
      (office.ops?.tasks ?? []).filter((t) => t.due && t.due < today && t.col !== 'Done').length,
      'committee tasks overdue',
      '/app/ops',
    ],
  ];
  const open = todo.filter(([n]) => n > 0);

  const dues = office.dues; // counted on the server per account, for finance roles

  const ranks = new Map<string, [number, string]>();
  for (const r of rated) {
    const k = rankFor(r);
    ranks.set(k.title, [(ranks.get(k.title)?.[0] ?? 0) + 1, k.color]);
  }
  const batches = new Map<number, number>();
  for (const m of active) batches.set(m.batch, (batches.get(m.batch) ?? 0) + 1);

  const kpis: [string, string | number, string][] = [
    [
      'Active members',
      active.length,
      `${people.filter((m) => m.pending).length} invited, not joined · ${people.filter((m) => m.suspended).length} suspended · ${counts.alumniCount ?? members.filter((m) => m.is_alumni).length} alumni`,
    ],
    [
      'Codeforces linked',
      `${pct(linked.length, active.length)}%`,
      `${linked.length} of ${active.length} · ${active.length - linked.length} without a handle`,
    ],
    ['Solving daily', daily, `${pct(daily, active.length)}% of active members on a streak`],
    ['Median rating', median || '—', median ? rankFor(median).title : 'nobody rated yet'],
  ];

  return (
    <div className="bento">
      {kpis.map(([l, v, d]) => (
        <section key={l} className="panel c3">
          <p className="label">{l}</p>
          <p className="big">{v}</p>
          <p className="body">{d}</p>
        </section>
      ))}

      <section className="panel c6">
        <p className="label">Needs a decision</p>
        {open.length ? (
          <ul className="list">
            {open.map(([n, what, to]) => (
              <li key={what}>
                <span className="grow">
                  <b>{n}</b> {what}
                </span>
                {typeof to === 'string' ? (
                  <Link className="btn xs line" href={to}>
                    Open
                  </Link>
                ) : (
                  <button className="btn xs line" onClick={to}>
                    Open
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="body">Nothing waiting.</p>
        )}
      </section>

      {dues && (
        <section className="panel c6">
          <p className="label">Money · current 3-month periods</p>
          <ul className="list">
            {(
              [
                ['Member dues', dues.term],
                ['Post dues', dues.post],
              ] as const
            )
              .filter(([, d]) => d.fee > 0)
              .map(([l, d]) => (
                <li key={l}>
                  <span style={{ minWidth: 120 }}>
                    {l} · {tk(d.fee)}
                  </span>
                  <span className="grow meter" style={css({ '--v': `${pct(d.paid, d.of)}%` })}>
                    <i />
                  </span>
                  <b className="mono">
                    {d.paid}/{d.of}
                  </b>
                  {d.waiting > 0 && <span className="label">{d.waiting} to verify</span>}
                </li>
              ))}
            <li>
              <span className="grow">Alumni contributions this term</span>
              <b className="mono">
                {tk(dues.gifts.amount)} · {dues.gifts.count}
              </b>
            </li>
            <li>
              <span className="grow">In / out this term</span>
              <b className="mono">
                +{tk(term.incoming)} / −{tk(term.spent)}
              </b>
            </li>
            <li>
              <span className="grow">Fund balance</span>
              <b className="mono">{tk(fundTotal)}</b>
            </li>
          </ul>
        </section>
      )}

      <section className="panel c6">
        <p className="label">Ratings · {rated.length} rated members</p>
        {rated.length ? (
          <Rows rows={[...ranks].map(([t, [n, c]]) => [t, n, c])} />
        ) : (
          <p className="body">No rated members yet.</p>
        )}
      </section>

      <section className="panel c6">
        <p className="label">Active members by batch</p>
        <Rows
          rows={[...batches]
            .sort((a, b) => b[0] - a[0])
            .map(([b, n]) => [b ? `Batch ${b}` : 'No batch', n])}
        />
      </section>

      {active.length > linked.length && (
        <section className="panel c6">
          <p className="label">No Codeforces handle · {active.length - linked.length}</p>
          <ul className="list">
            {active
              .filter((m) => !m.cf_handle)
              .slice(0, 8)
              .map((m) => (
                <li key={m.id}>
                  <Link
                    className="link grow"
                    href={`/app/directory?q=${encodeURIComponent(m.name)}`}
                  >
                    {m.name}
                  </Link>
                  <span className="label">{m.batch ? `Batch ${m.batch}` : ''}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {exp && <ExportTile />}
    </div>
  );
}

function ExportTile() {
  const { toast } = useStore();
  const download = async () => {
    const res = await fetch('/api/export/members');
    if (!res.ok) return toast((await res.json()).error ?? 'The export failed.', 'bad');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = 'members.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="panel c6">
      <p className="label">Member list</p>
      <p className="body">Exports are written to the audit log.</p>
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={download}>
        Export members (CSV)
      </button>
    </section>
  );
}
