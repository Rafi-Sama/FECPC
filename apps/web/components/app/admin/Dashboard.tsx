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
          <span className="min-w-[120px]">{l}</span>
          <span className="grow meter" style={css({ '--v': `${(n / max) * 100}%` })}>
            <i style={color ? { background: color } : undefined} />
          </span>
          <b className="mono min-w-[32px] text-right">{n}</b>
        </li>
      ))}
    </ul>
  );
}

/** The executive overview, counted from the live state payload. A role only sees what it can act on. */
export function Dashboard({ go, exp }: { go: (tab: string) => void; exp: boolean }) {
  const { office, term, fundTotal, counts } = useStore();
  // Counted on the server (office.people), so the dashboard never waits for the roster.
  const p = office.people ?? {
    active: 0,
    invited: 0,
    suspended: 0,
    linked: 0,
    rated: 0,
    median: 0,
    daily: 0,
    ranks: [],
    batches: [],
    unlinked: [],
  };
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

  const kpis: [string, string | number, string][] = [
    [
      'Active members',
      p.active,
      `${p.invited} invited, not joined · ${p.suspended} suspended · ${counts.alumniCount} alumni`,
    ],
    [
      'Codeforces linked',
      `${pct(p.linked, p.active)}%`,
      `${p.linked} of ${p.active} · ${p.active - p.linked} without a handle`,
    ],
    ['Solving daily', p.daily, `${pct(p.daily, p.active)}% of active members on a streak`],
    ['Median rating', p.median || '—', p.median ? rankFor(p.median).title : 'nobody rated yet'],
  ];

  return (
    <div className="bento">
      {kpis.map(([l, v, d]) => (
        <section key={l} className="panel min-[1100px]:[.bento_>_&]:col-[span_3]">
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
                  <span className="min-w-[120px]">
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
        <p className="label">Ratings · {p.rated} rated members</p>
        {p.rated ? <Rows rows={p.ranks} /> : <p className="body">No rated members yet.</p>}
      </section>

      <section className="panel c6">
        <p className="label">Active members by batch</p>
        <Rows rows={p.batches.map(([b, n]) => [b ? `Batch ${b}` : 'No batch', n])} />
      </section>

      {p.active > p.linked && (
        <section className="panel c6">
          <p className="label">No Codeforces handle · {p.active - p.linked}</p>
          <ul className="list">
            {p.unlinked.map((m) => (
              <li key={m.id}>
                <Link className="link grow" href={`/app/directory?q=${encodeURIComponent(m.name)}`}>
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
      <button className="btn sm self-start" onClick={download}>
        Export members (CSV)
      </button>
    </section>
  );
}
