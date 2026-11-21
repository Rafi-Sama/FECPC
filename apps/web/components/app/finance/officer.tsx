'use client';
// The officer side of Finance: verifying payments, filing and deciding expenses, the club fund.
// Each tab appears only for roles whose capability allows it; the API enforces every decision again.
import { Bars } from '@/components/app/Charts';
import QR from '@/components/app/QR';
import { useStore } from '@/components/app/Store';
import { APPROVAL_THRESHOLD } from '@fecpc/content/member-area';
import { fmtDate } from '@fecpc/content/site';
import { can, canFully, isCommittee, type Who } from '@fecpc/contracts';

const tk = (n: number) => '৳' + Math.round(Math.abs(n)).toLocaleString('en-US');
const css = (o: Record<string, string | number>) => o as React.CSSProperties;

/** The officer tabs this role may open, in display order. */
export function officerTabs(role: Who): string[] {
  const verify = can(role, 'payments.verify'),
    approve = can(role, 'expense.approve');
  return [
    ...(verify ? ['Payments'] : []),
    ...(isCommittee(role) ? ['My requests'] : []),
    ...(approve ? ['Expenses'] : []),
    ...(verify || approve ? ['Club fund'] : []),
  ];
}

// For reconciling against wallet statements. A leading = + - @ would run as a formula in a spreadsheet.
function download(name: string, rows: unknown[][]) {
  const cell = (v: unknown) => {
    const t = String(v ?? '');
    return `"${(/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replaceAll('"', '""')}"`;
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([rows.map((r) => r.map(cell).join(',')).join('\n') + '\n'], { type: 'text/csv' }),
  );
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function OfficerPanel({ tab }: { tab: string }) {
  if (tab === 'Payments') return <Payments />;
  if (tab === 'My requests') return <MyRequests />;
  if (tab === 'Expenses') return <Expenses />;
  if (tab === 'Club fund') return <ClubFund />;
  return null;
}

function Payments() {
  const { s, act, office } = useStore();
  const queue = office.queue ?? [];
  const reject = (id: string) => {
    const reason = prompt('Why is this payment rejected? The member is shown this.');
    if (reason) act('decide', { kind: 'payment', id, to: 'rejected', reason });
  };
  return (
    <div className="stack">
      {queue.length === 0 ? (
        <p className="body">No payments have been submitted yet.</p>
      ) : (
        <button
          className="btn xs line"
          style={{ alignSelf: 'flex-end' }}
          onClick={() =>
            download('payments.csv', [
              ['id', 'member', 'for', 'amount', 'via', 'trx', 'sender', 'status', 'submitted'],
              ...queue.map((q) => [
                q.id,
                q.name,
                q.label,
                q.amount,
                q.via,
                q.trx,
                q.sender,
                q.status,
                q.at,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      )}
      <div className="scroll-x">
        <table className="tbl cards">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Member</th>
              <th>Submitted</th>
              <th>Via · Trx ID · Sender</th>
              <th className="r">Amount</th>
              <th className="r">Decision</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((q) => {
              const st = s.queue[q.id] === 'pending' ? '' : s.queue[q.id];
              return (
                <tr key={q.id}>
                  <td className="mono">{q.id}</td>
                  <td>
                    <strong>{q.name}</strong>
                    <br />
                    <span className="label">{q.label}</span>
                  </td>
                  <td className="label">
                    {new Date(q.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="mono">
                    {q.via} · {q.trx} · {q.sender}
                  </td>
                  <td className="r mono">{tk(q.amount)}</td>
                  <td className="r">
                    {st ? (
                      <span className={`pill ${st === 'verified' ? 'ok' : 'bad'}`}>{st}</span>
                    ) : q.mine ? (
                      <span className="pill">yours · needs another verifier</span>
                    ) : canFully(s.roles, 'payments.verify') ? (
                      <span
                        className="row"
                        style={css({
                          '--g': '6px',
                          justifyContent: 'flex-end',
                          flexWrap: 'nowrap',
                        })}
                      >
                        <button
                          className="btn xs"
                          onClick={() =>
                            confirm(
                              `Verify ${q.id}: ${tk(q.amount)} from ${q.name}? Check it against the wallet statement first.`,
                            ) && act('decide', { kind: 'payment', id: q.id, to: 'verified' })
                          }
                        >
                          Verify
                        </button>
                        <button className="btn xs line" onClick={() => reject(q.id)}>
                          Reject
                        </button>
                      </span>
                    ) : (
                      <span className="pill">pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MyRequests() {
  const { act, myExpenses } = useStore();
  return (
    <div className="stack">
      <form
        className="panel grid"
        style={css({ '--min': '200px', '--g': '12px', alignItems: 'end' })}
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget,
            d = new FormData(f);
          act('expense', {
            what: d.get('what'),
            amount: Number(d.get('amount')),
            event: d.get('event'),
          }).then((ok) => ok && f.reset());
        }}
      >
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span className="label">What is it for</span>
          <input
            name="what"
            className="input"
            required
            minLength={3}
            maxLength={140}
            placeholder="Printed problem sets, 60 copies"
          />
        </label>
        <label className="field">
          <span className="label">Amount (৳)</span>
          <input
            name="amount"
            className="input mono"
            type="number"
            required
            min={1}
            max={1000000}
            step={1}
          />
        </label>
        <label className="field">
          <span className="label">Event (optional)</span>
          <input name="event" className="input" maxLength={80} />
        </label>
        <button className="btn sm">Request expense</button>
      </form>
      {myExpenses.length === 0 ? (
        <p className="body">You have not filed any expense requests.</p>
      ) : (
        <div className="list">
          {myExpenses.map((x) => (
            <div key={x.id}>
              <span className="grow">
                <strong>{x.what}</strong>
                <br />
                <span className="label">
                  {x.id}
                  {x.event ? ` · ${x.event}` : ''}
                </span>
              </span>
              <span className="mono" style={{ fontSize: 20 }}>
                {tk(x.amount)}
              </span>
              <span
                className={`pill ${x.status === 'approved' ? 'ok' : x.status === 'rejected' ? 'bad' : 'warn'}`}
              >
                {x.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Expenses() {
  const { s, me, act, office } = useStore();
  const expenses = office.expenses ?? [];
  const approve = can(s.roles, 'expense.approve');
  return (
    <div className="stack">
      <p className="body" style={{ maxWidth: '70ch' }}>
        Up to {tk(APPROVAL_THRESHOLD)} one officer decides. Above it, one officer passes the request
        up and a second, with full authority, decides. Nobody decides their own request.
      </p>
      {expenses.length === 0 && <p className="body">No expense requests.</p>}
      <div className="list">
        {expenses.map((x) => {
          const big = x.amount > APPROVAL_THRESHOLD,
            st =
              x.status === 'pending'
                ? ''
                : x.status === 'sent to President' && approve === true
                  ? ''
                  : x.status,
            mine = !big || x.status === 'sent to President';
          return (
            <div key={x.id} style={{ flexWrap: 'wrap' }}>
              <span className="grow">
                <strong>{x.what}</strong>
                <br />
                <span className="label">
                  {x.id} · requested by {x.name} · {x.event}
                  {big ? ' · above threshold' : ''}
                </span>
              </span>
              <span className="mono" style={{ fontSize: 20 }}>
                {tk(x.amount)}
              </span>
              {st ? (
                <span
                  className={`pill ${st === 'rejected' ? 'bad' : st === 'approved' ? 'ok' : 'warn'}`}
                >
                  {st}
                </span>
              ) : x.by === me.id ? (
                <span className="pill">your request</span>
              ) : mine ? (
                <>
                  <button
                    className="btn xs"
                    onClick={() =>
                      confirm(`Approve ${x.id}: ${tk(x.amount)} for "${x.what}"?`) &&
                      act('decide', { kind: 'expense', id: x.id, to: 'approved' })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="btn xs line"
                    onClick={() =>
                      confirm(`Reject ${x.id}? This cannot be undone.`) &&
                      act('decide', { kind: 'expense', id: x.id, to: 'rejected' })
                    }
                  >
                    Reject
                  </button>
                </>
              ) : (
                <button
                  className="btn xs line"
                  onClick={() =>
                    act('decide', { kind: 'expense', id: x.id, to: 'sent to President' })
                  }
                >
                  Pass up for a second decision
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClubFund() {
  const { s, act, office, fundTotal } = useStore();
  const edit = canFully(s.roles, 'payments.verify');
  const { accounts = [], budgets = [], cashflow = [], ledger = [] } = office.fund ?? {};
  return (
    <div className="bento">
      <p className="body" style={{ gridColumn: '1 / -1' }} role="note">
        Verified payments and approved expenses update the balance, ledger and budgets. The opening
        balance, accounts and cash flow are sample figures.
      </p>
      <section className="panel c4">
        <p className="label">Balance</p>
        <p className="big">{tk(fundTotal)}</p>
        <ul className="list">
          {accounts.map(([n, v]) => (
            <li key={n}>
              <span>{n}</span>
              <span className="mono">{tk(v)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel c8">
        <p className="label">Cash flow, 12 months (thousand ৳)</p>
        <Bars data={cashflow} unit="k" />
      </section>
      <section className="panel c6">
        <p className="label">Event budgets · spent = approved expenses filed under the name</p>
        {budgets.map((g) => {
          const hot = g.spent / g.plan >= 0.8;
          return (
            <div key={g.id} className="stack" style={css({ '--g': '6px' })}>
              <div className="row between">
                <span>{g.name}</span>
                <span className={`mono ${hot ? 'bad' : ''}`}>
                  {tk(g.spent)} / {tk(g.plan)}
                  {hot ? ' · 80% alert' : ''}
                </span>
              </div>
              <div
                className="meter"
                style={css({ '--v': `${Math.min(100, (g.spent / g.plan) * 100)}%` })}
              >
                <i style={hot ? { background: 'var(--bad)' } : undefined} />
              </div>
              {edit && (
                <span className="row" style={css({ '--g': '6px' })}>
                  <button
                    className="btn xs line"
                    onClick={() => {
                      const plan = Number(prompt(`Plan for ${g.name}, in taka`, String(g.plan)));
                      if (plan) act('saveBudget', { id: g.id, name: g.name, plan });
                    }}
                  >
                    Edit plan
                  </button>
                  <button
                    className="btn xs line danger"
                    onClick={() =>
                      confirm(`Delete the ${g.name} budget?`) && act('deleteBudget', { id: g.id })
                    }
                  >
                    Delete
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {edit && (
          <form
            className="row"
            style={css({ '--g': '8px' })}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = new FormData(f);
              if (await act('saveBudget', { name: d.get('name'), plan: Number(d.get('plan')) }))
                f.reset();
            }}
          >
            <input
              name="name"
              className="input"
              style={{ flex: '1 1 160px' }}
              placeholder="Event name"
              aria-label="Budget name"
              required
              minLength={3}
            />
            <input
              name="plan"
              type="number"
              min={1}
              className="input sm"
              placeholder="Plan ৳"
              aria-label="Plan in taka"
              required
            />
            <button className="btn xs">Add budget</button>
          </form>
        )}
      </section>
      <section className="panel c6">
        <p className="label">Ledger</p>
        <div className="scroll-x">
          <table className="tbl">
            <tbody>
              {ledger.map((l) => (
                <tr key={l.what}>
                  <td className="label">{fmtDate(l.date)}</td>
                  <td>{l.what}</td>
                  <td className="r mono">
                    <span className={l.amt < 0 ? 'bad' : 'ok'}>
                      {l.amt < 0 ? '−' : '+'}
                      {tk(l.amt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** A printable receipt for one verified payment. */
export function Receipt({
  id,
  label,
  amount,
  date,
  via,
}: {
  id: string;
  label: string;
  amount: number;
  date: string;
  via: string;
}) {
  const { me } = useStore();
  return (
    <div className="panel receipt">
      <div className="row between">
        <div>
          <p className="label">Receipt</p>
          <p className="mono" style={{ fontSize: 22 }}>
            {id}
          </p>
        </div>
        <QR text={`FECPC receipt ${id} ৳${amount}`} size={84} />
      </div>
      <dl>
        {[
          ['Received from', me.name],
          ['For', label],
          ['Amount', `৳${amount}`],
          ['Paid via', via],
          ['Date', fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' })],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button className="btn sm no-print" onClick={() => print()}>
        Print or save as PDF
      </button>
    </div>
  );
}
