'use client';
import { useMore } from '@/components/site/More';
// The officer side of Finance: verifying payments, filing and deciding expenses, the club fund.
// Each tab appears only for roles whose capability allows it; the API enforces every decision again.
import { useEffect, useState } from 'react';
import { usePrompt, useConfirm } from '@/components/app/shared/PromptDialog';
import { SaveForm } from '@/components/app/SaveBar';
import { Bars } from '@/components/app/Charts';
import QR from '@/components/app/QR';
import { useStore } from '@/components/app/Store';
import { APPROVAL_THRESHOLD } from '@fecpc/content/member-area';
import { fmtDate } from '@fecpc/content/site';
import {
  can,
  canFully,
  isCommittee,
  PERIOD_MONTHS,
  type Expense,
  type Who,
} from '@fecpc/contracts';

const tk = (n: number) => '৳' + Math.round(Math.abs(n)).toLocaleString('en-US');
const css = (o: Record<string, string | number>) => o as React.CSSProperties;
/** A Finance section: a bordered panel with a small uppercase header row. */
export const financePanel =
  '[background:var(--panel)] [border:1px_solid_var(--line)] p-6 min-w-0 t-b:[border:2px_solid_var(--ink)] t-b:[background:var(--panel)] [&>header]:flex [&>header]:justify-between [&>header]:gap-3 [&>header]:items-center [&>header]:pb-3 [&>header]:[border-bottom:1px_solid_var(--line)] [&>header]:mb-2 [&>header]:[font:11px_var(--f-label)] [&>header]:tracking-[0.06em] [&>header]:uppercase [&>header]:text-hi [&>header_small]:[color:var(--dim)]';

/** The officer tabs this role may open, in display order. */
export function officerTabs(role: Who): string[] {
  const verify = can(role, 'payments.verify'),
    approve = can(role, 'expense.approve');
  return [
    ...(verify ? ['Payments'] : []),
    ...(verify || approve ? ['Member dues'] : []),
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
  if (tab === 'Member dues') return <MemberDues />;
  if (tab === 'My requests') return <MyRequests />;
  if (tab === 'Expenses') return <Expenses />;
  if (tab === 'Club fund') return <ClubFund />;
  return null;
}

type DuesRow = NonNullable<ReturnType<typeof useStore>['office']['dues']>['members'][number];
type Standing = 'overdue' | 'due' | 'waiting' | 'paid';
const STANDING_ORDER: Standing[] = ['overdue', 'due', 'waiting', 'paid'];
const standingOf = (m: DuesRow): Standing =>
  m.overdue ? 'overdue' : m.unpaid ? 'due' : m.waiting ? 'waiting' : 'paid';
const DUE_FILTERS = [
  ['owing', 'Owing', (m: DuesRow) => m.unpaid > 0],
  ['overdue', 'Overdue', (m: DuesRow) => m.overdue > 0],
  ['waiting', 'Waiting', (m: DuesRow) => m.waiting > 0],
  ['paid', 'Paid up', (m: DuesRow) => standingOf(m) === 'paid'],
  ['all', 'Everyone', () => true],
] as const;
const EMPTY: Record<(typeof DUE_FILTERS)[number][0], string> = {
  owing: 'Nobody owes anything right now.',
  overdue: 'Nobody is overdue.',
  waiting: 'No payments are waiting for a check.',
  paid: 'Nobody is fully paid up yet.',
  all: 'No members are billed yet.',
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `TERM-2026-11` → "Nov ’26"; post dues say so. */
const billLabel = (id: string) => {
  const [kind, y, m] = id.split('-');
  return `${kind === 'POST' ? 'Post · ' : ''}${MON[Number(m) - 1]} ’${y!.slice(2)}`;
};
const longDate = (d: string) => fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' });

/** Who has paid, who has not, and for how long: every member's dues standing, worst first. */
function MemberDues() {
  const { office } = useStore();
  const all = office.dues?.members ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<(typeof DUE_FILTERS)[number][0]>('owing');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const test = DUE_FILTERS.find((f) => f[0] === filter)![2];
  const rows = all
    .filter(test)
    .filter(
      (m) => !needle || `${m.name} ${m.no ?? ''} ${m.batch ?? ''}`.toLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        STANDING_ORDER.indexOf(standingOf(a)) - STANDING_ORDER.indexOf(standingOf(b)) ||
        b.overdue - a.overdue ||
        b.owed - a.owed ||
        a.name.localeCompare(b.name),
    );
  const [shown, more] = useMore(rows, 30);
  const overdue = all.filter((m) => m.overdue > 0);
  const paid = all.filter((m) => standingOf(m) === 'paid').length;
  const owed = all.reduce((a, m) => a + m.owed, 0);
  const lateMonths = overdue.reduce((a, m) => a + m.overdue * PERIOD_MONTHS, 0);

  return (
    <div className="[display:grid] gap-6">
      <div className="finance-stats min-[721px]:[grid-template-columns:repeat(4,1fr)]">
        <div>
          <small>Owed to the club</small>
          <b>{tk(owed)}</b>
          <small>{all.filter((m) => m.unpaid).length} members with an open bill</small>
        </div>
        <div>
          <small>Overdue</small>
          <b className={overdue.length ? 'text-bad' : '[color:var(--tone-good)]'}>
            {overdue.length}
          </b>
          <small>
            {overdue.length ? `${lateMonths} months late in total` : 'everyone is on time'}
          </small>
        </div>
        <div>
          <small>Waiting for a check</small>
          <b>{all.filter((m) => m.waiting).length}</b>
          <small>in the Payments tab</small>
        </div>
        <div>
          <small>Paid up</small>
          <b className="[color:var(--tone-good)]">
            {paid}
            <span className="text-[18px] text-dim"> / {all.length}</span>
          </b>
          <div
            className="dues-meter"
            role="img"
            aria-label={`${paid} of ${all.length} members paid up`}
          >
            <i style={{ width: `${all.length ? (paid / all.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <section className={financePanel}>
        <header>
          <span>Member dues</span>
          <small>
            {rows.length} of {all.length} members · bills every {PERIOD_MONTHS} months
          </small>
        </header>
        <div className="finance-tools items-center">
          <input
            type="search"
            aria-label="Search members"
            placeholder="Search name, member no. or batch"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            onClick={() =>
              download(`member-dues-${today}.csv`, [
                [
                  'member',
                  'no',
                  'batch',
                  'standing',
                  'paid',
                  'waiting',
                  'unpaid',
                  'overdue',
                  'owed',
                  'overdue since',
                ],
                ...rows.map((m) => [
                  m.name,
                  m.no,
                  m.batch,
                  standingOf(m),
                  m.paid,
                  m.waiting,
                  m.unpaid,
                  m.overdue,
                  m.owed,
                  m.since,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        </div>
        <div className="finance-tabs mb-2! mt-2" role="tablist" aria-label="Show">
          {DUE_FILTERS.map(([k, label, f]) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === filter}
              className={k === filter ? 'active' : ''}
              onClick={() => setFilter(k)}
            >
              {label} · {all.filter(f).length}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-mut">
            {needle ? `No member matches “${q.trim()}”.` : EMPTY[filter]}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="finance-table dues-table w-full border-collapse min-w-[540px]">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Standing</th>
                  <th>Bills, oldest first</th>
                  <th className="right">Owes</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => {
                  const st = standingOf(m);
                  const next = m.bills.find((x) => x.status === 'unpaid');
                  return (
                    <tr key={m.id}>
                      <td>
                        <strong className="block">{m.name}</strong>
                        <span className="text-[14px] text-dim">
                          {[m.no && `No. ${m.no}`, m.batch && `Batch ${m.batch}`]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </td>
                      <td>
                        {st === 'overdue' ? (
                          <>
                            <span className="finance-tag rejected">
                              <i />
                              {m.overdue * PERIOD_MONTHS} months overdue
                            </span>
                            <span className="block mt-1.5 text-[14px] text-dim">
                              since {longDate(m.since!)}
                            </span>
                          </>
                        ) : st === 'due' ? (
                          <>
                            <span className="finance-tag due">
                              <i />
                              Due
                            </span>
                            <span className="block mt-1.5 text-[14px] text-dim">
                              by {longDate(next!.due)}
                            </span>
                          </>
                        ) : st === 'waiting' ? (
                          <span className="finance-tag pending">
                            <i />
                            Waiting for a check
                          </span>
                        ) : (
                          <span className="finance-tag ok">
                            <i />
                            Paid up
                          </span>
                        )}
                      </td>
                      <td>
                        <ul className="dues-bills" aria-label={`${m.name}: bills`}>
                          {m.bills.slice(-6).map((x) => {
                            const s =
                              x.status === 'unpaid' ? (x.due < today ? 'late' : 'open') : x.status;
                            const what = {
                              paid: 'paid',
                              waiting: 'waiting for a check',
                              late: 'overdue',
                              open: 'not due yet',
                            }[s];
                            return (
                              <li
                                key={x.id}
                                data-s={s}
                                title={`${billLabel(x.id)}: ${what}, due ${longDate(x.due)}`}
                              >
                                {billLabel(x.id)}
                                <span className="sr-only">: {what}</span>
                              </li>
                            );
                          })}
                          {m.bills.length > 6 && (
                            <li data-s="more">+{m.bills.length - 6} earlier</li>
                          )}
                        </ul>
                      </td>
                      <td className="right">
                        {m.owed ? (
                          <strong className={`num ${st === 'overdue' ? 'text-bad' : ''}`}>
                            {tk(m.owed)}
                          </strong>
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {more}
      </section>
    </div>
  );
}

function Payments() {
  const sure = useConfirm();
  const { s, act, office } = useStore();
  const ask = usePrompt();
  const queue = office.queue ?? [];
  const [queueShown, queueMore] = useMore(queue, 30);
  const reject = async (id: string) => {
    const reason = await ask({
      title: 'Reject payment',
      label: 'Why is it rejected? The member is shown this.',
      minLength: 3,
      confirmLabel: 'Reject payment',
      danger: true,
    });
    if (reason) act('decide', { kind: 'payment', id, to: 'rejected', reason });
  };
  return (
    <div className="stack">
      {queue.length === 0 ? (
        <p className="body">No payments have been submitted yet.</p>
      ) : (
        <button
          className="btn xs line self-end"

          onClick={() =>
            download('payments.csv', [
              [
                'id',
                'member',
                'for',
                'amount',
                'via',
                'to',
                'trx',
                'sender',
                'status',
                'submitted',
              ],
              ...queue.map((q) => [
                q.id,
                q.name,
                q.label,
                q.amount,
                q.via,
                q.paidTo,
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
        <table className="tbl cards max-[701px]:[&_thead]:hidden max-[701px]:block max-[701px]:w-full max-[701px]:[&_tbody]:block max-[701px]:[&_tbody]:w-full max-[701px]:[&_tr]:block max-[701px]:[&_tr]:w-full max-[701px]:[&_td]:block max-[701px]:[&_td]:w-full max-[701px]:[&_tr]:p-[14px_0] max-[701px]:[&_tr]:[border-bottom:1px_solid_var(--line2)] max-[701px]:[&_td]:p-[3px_0] max-[701px]:[&_td]:[border:0] max-[701px]:[&_td]:text-left max-[701px]:[&_td]:wrap-anywhere">
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
            {queueShown.map((q) => {
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
                    {q.via}
                    {q.paidTo ? ` to ${q.paidTo}` : ''} · {q.trx} · {q.sender}
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
                          onClick={async () =>
                            (await sure(
                              `Verify ${q.id}: ${tk(q.amount)} from ${q.name}? Check it against the wallet statement first.`,
                            )) && act('decide', { kind: 'payment', id: q.id, to: 'verified' })
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
      {queueMore}
    </div>
  );
}

/** Filed when, decided by whom and when: the request's history in one line. */
function ExpenseHistory({ x }: { x: Expense }) {
  if (!x.at) return null;
  return (
    <span className="label block">
      Filed {fmtDate(x.at.slice(0, 10))}
      {x.decidedAt && x.decidedBy
        ? ` · ${x.status} by ${x.decidedBy} on ${fmtDate(x.decidedAt.slice(0, 10))}`
        : ''}
    </span>
  );
}

function MyRequests() {
  const { act, myExpenses } = useStore();
  const [mineShown, mineMore] = useMore(myExpenses, 20);
  return (
    <div className="stack">
      <SaveForm
        className="panel grid"
        style={css({ '--min': '200px', '--g': '12px', alignItems: 'end' })}
        label="Expense request not filed"
        saveLabel="Request expense"
        onSubmit={async (e) => {
          const f = e.currentTarget,
            d = new FormData(f);
          const ok = await act('expense', {
            what: String(d.get('what')).trim(),
            amount: Number(d.get('amount')),
            event: String(d.get('event')).trim(),
          });
          if (ok) f.reset();
          return ok;
        }}
      >
        <label className="field col-[span_2]">
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
        <div>
          <button type="submit" className="btn sm">
            Request expense
          </button>
        </div>
      </SaveForm>
      {myExpenses.length === 0 ? (
        <p className="body">You have not filed any expense requests.</p>
      ) : (
        <div className="list">
          {mineShown.map((x) => (
            <div key={x.id}>
              <span className="grow">
                <strong>{x.what}</strong>
                <br />
                <span className="label">
                  {x.id}
                  {x.event ? ` · ${x.event}` : ''}
                </span>
                <ExpenseHistory x={x} />
              </span>
              <span className="mono text-[20px]">{tk(x.amount)}</span>
              <span
                className={`pill ${x.status === 'approved' ? 'ok' : x.status === 'rejected' ? 'bad' : 'warn'}`}
              >
                {x.status}
              </span>
            </div>
          ))}
          {mineMore}
        </div>
      )}
    </div>
  );
}

function Expenses() {
  const sure = useConfirm();
  const { s, me, act, office } = useStore();
  const expenses = office.expenses ?? [];
  const [expShown, expMore] = useMore(expenses, 20);
  const approve = can(s.roles, 'expense.approve');
  return (
    <div className="stack">
      <p className="body max-w-[70ch]">
        Up to {tk(APPROVAL_THRESHOLD)} one officer decides. Above it, one officer passes the request
        up and a second, with full authority, decides. Nobody decides their own request.
      </p>
      {expenses.length === 0 && <p className="body">No expense requests.</p>}
      <div className="list">
        {expShown.map((x) => {
          const big = x.amount > APPROVAL_THRESHOLD,
            st =
              x.status === 'pending'
                ? ''
                : x.status === 'sent to President' && approve === true
                  ? ''
                  : x.status,
            mine = !big || x.status === 'sent to President';
          return (
            <div className="flex-wrap" key={x.id}>
              <span className="grow">
                <strong>{x.what}</strong>
                <br />
                <span className="label">
                  {x.id} · requested by {x.name} · {x.event}
                  {big ? ' · above threshold' : ''}
                </span>
                <ExpenseHistory x={x} />
              </span>
              <span className="mono text-[20px]">{tk(x.amount)}</span>
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
                    onClick={async () =>
                      (await sure(`Approve ${x.id}: ${tk(x.amount)} for "${x.what}"?`)) &&
                      act('decide', { kind: 'expense', id: x.id, to: 'approved' })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="btn xs line"
                    onClick={async () =>
                      (await sure(`Reject ${x.id}? This cannot be undone.`)) &&
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
        {expMore}
      </div>
    </div>
  );
}

function ClubFund() {
  const sure = useConfirm();
  const { s, act, office, fundTotal, term } = useStore();
  const ask = usePrompt();
  const edit = canFully(s.roles, 'payments.verify');
  const { accounts = [], budgets = [], ledger = [] } = office.fund ?? {};
  const [ledgerShown, ledgerMore] = useMore(ledger, 30);
  return (
    <div className="bento">
      <p className="body col-span-full" role="note">
        Verified payments and approved expenses update the balance, ledger and budgets. The opening
        balance and accounts are sample figures.
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
        <p className="label">Money in, last 6 months (thousand ৳)</p>
        <Bars data={term.flow.map((m) => Math.round(m.in / 100) / 10)} unit="k" />
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
                    onClick={async () => {
                      const plan = Number(
                        await ask({
                          title: `Plan for ${g.name}`,
                          label: 'Amount in taka',
                          initial: String(g.plan),
                          numeric: true,
                          confirmLabel: 'Save plan',
                        }),
                      );
                      if (plan > 0) act('saveBudget', { id: g.id, name: g.name, plan });
                    }}
                  >
                    Edit plan
                  </button>
                  <button
                    className="btn xs line danger"
                    onClick={async () =>
                      (await sure(`Delete the ${g.name} budget?`)) &&
                      act('deleteBudget', { id: g.id })
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
          <SaveForm
            className="row"
            style={css({ '--g': '8px' })}
            label="Budget not added"
            saveLabel="Add budget"
            onSubmit={async (e) => {
              const f = e.currentTarget,
                d = new FormData(f);
              const ok = await act('saveBudget', {
                name: String(d.get('name')).trim(),
                plan: Number(d.get('plan')),
              });
              if (ok) f.reset();
              return ok;
            }}
          >
            <input
              name="name"
              className="input flex-[1_1_160px]"
              placeholder="Event name"
              aria-label="Budget name"
              required
              minLength={3}
              maxLength={80}
            />
            <input
              name="plan"
              type="number"
              min={1}
              max={10000000}
              step={1}
              className="input sm"
              placeholder="Plan ৳"
              aria-label="Plan in taka"
              required
            />
            <button type="submit" className="btn sm">
              Add budget
            </button>
          </SaveForm>
        )}
      </section>
      <section className="panel c6">
        <p className="label">Ledger</p>
        <div className="scroll-x">
          <table className="tbl">
            <tbody>
              {ledgerShown.map((l) => (
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
        {ledgerMore}
      </section>
    </div>
  );
}

/** One verified payment's receipt, in a modal. Printing prints only the receipt (see `.receipt-modal` print rules). */
export function Receipt({
  id,
  label,
  amount,
  date,
  via,
  onClose,
}: {
  id: string;
  label: string;
  amount: number;
  date: string;
  via: string;
  onClose: () => void;
}) {
  const { me } = useStore();
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center [align-items:safe_center] overflow-y-auto p-[4vh_20px] [background:rgba(0,0,0,0.62)] [backdrop-filter:blur(2px)] max-[721px]:p-0 receipt-modal print:[body:has(.receipt-modal)_&]:visible print:[body:has(.receipt-modal)_&_*]:visible print:absolute print:inset-[0_auto_auto_0] print:w-full print:block print:p-0 print:[background:none] print:[backdrop-filter:none]"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="finance-modal receipt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <button
          className="absolute z-3 top-3.5 right-3.5 w-[40px] h-[40px] p-0 [border:1px_solid_var(--line2)] [background:var(--panel)] text-[22px] t-b:[border:2px_solid_var(--ink)] no-print"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="row between">
          <div>
            <p className="label">FECPC · Payment receipt</p>
            <p id="receipt-title" className="mono text-[22px]">
              {id}
            </p>
          </div>
        </div>
        <dl>
          {[
            ['Received from', me.name],
            ['For', label],
            ['Amount', `৳${amount.toLocaleString('en-US')}`],
            ['Paid via', via],
            ['Date', fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' })],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="label">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="row between">
          <QR text={`FECPC ${id} | ${label} | BDT ${amount} | ${via} | ${date}`} size={128} />
          <button className="btn sm no-print" onClick={() => print()}>
            Print or save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
