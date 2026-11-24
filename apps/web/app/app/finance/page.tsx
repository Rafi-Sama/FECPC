'use client';

import { useEffect, useMemo, useState } from 'react';
import { Page } from '@/components/app/Shell';
import QR from '@/components/app/QR';
import { OfficerPanel, officerTabs, Receipt } from '@/components/app/finance/officer';
import { useStore } from '@/components/app/Store';
import { canFully, feesOf } from '@fecpc/contracts';
import { CONTRIBUTION, owes } from '@fecpc/content/member-area';
import { fmtDate } from '@fecpc/content/site';

const tk = (n: number) => '৳' + Math.round(Math.abs(n)).toLocaleString('en-US');
const wallets = {
  bkash: {
    label: 'bKash',
    number: '01700000000',
    account: 'Personal · Club Treasurer',
    color: '#e2136e',
  },
  nagad: {
    label: 'Nagad',
    number: '01800000000',
    account: 'Personal · Club Treasurer',
    color: '#f6921e',
  },
} as const;
type Wallet = keyof typeof wallets;

const dateLabel = (value: string, year = false) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  });
const daysUntil = (value: string) =>
  Math.round(
    (new Date(`${value}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) /
      86_400_000,
  );

function StatusTag({ status, due }: { status: string; due?: string }) {
  if (status === 'verified')
    return (
      <span className="finance-tag ok">
        <i />
        Paid
      </span>
    );
  if (status === 'pending')
    return (
      <span className="finance-tag pending">
        <i />
        Awaiting verification
      </span>
    );
  if (status === 'waived')
    return (
      <span className="finance-tag ok">
        <i />
        Waived
      </span>
    );
  if (status === 'rejected')
    return (
      <span className="finance-tag rejected">
        <i />
        Rejected
      </span>
    );
  const days = due ? daysUntil(due) : 0;
  return days < 0 ? (
    <span className="finance-tag rejected">
      <i />
      Overdue · {-days}d
    </span>
  ) : (
    <span className="finance-tag due">
      <i />
      Due
    </span>
  );
}

function PaymentModal({
  invoice,
  onClose,
}: {
  invoice: { id: string; label: string; amount: number; due: string };
  onClose: () => void;
}) {
  const { act } = useStore();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<Wallet | null>(null);
  const [sender, setSender] = useState('');
  const [trx, setTrx] = useState('');
  const gift = invoice.id === 'GIFT'; // an alumni contribution: any amount, no invoice, no receipt
  const [amount, setAmount] = useState(gift ? '' : String(invoice.amount));
  const [error, setError] = useState('');
  const wallet = method ? wallets[method] : null;
  const sum = gift ? 'any amount' : tk(invoice.amount);

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

  const submit = async () => {
    const cleanSender = sender.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    const cleanTrx = trx.trim().toUpperCase();
    const numericAmount = Number(amount.replace(/\D/g, ''));
    if (!/^01[3-9]\d{8}$/.test(cleanSender))
      return setError('Enter the 11-digit number the money was sent from.');
    if (!/^[A-Z0-9]{8,12}$/.test(cleanTrx))
      return setError('Transaction ID must be 8 to 12 letters and digits.');
    if (!Number.isInteger(numericAmount) || numericAmount < 1)
      return setError('Enter the amount you sent.');
    if (!wallet) return;
    setError('');
    const paid = { via: wallet.label, trx: cleanTrx, sender: cleanSender };
    const ok = gift
      ? await act('contribute', { ...paid, amount: numericAmount })
      : await act('pay', { ...paid, invoice: invoice.id });
    if (ok) setStep(3);
  };

  return (
    <div
      className="finance-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="finance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
      >
        <button className="finance-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <header className="finance-modal-head">
          <h2 id="payment-title">
            {gift ? (
              <>
                Contribute<em>.</em>
              </>
            ) : (
              <>
                Pay <em>{tk(invoice.amount)}.</em>
              </>
            )}
          </h2>
          <span className="finance-mono">
            {gift ? invoice.label : `${invoice.id} · ${invoice.label}`}
          </span>
        </header>
        {step < 3 && (
          <div className="finance-steps">
            {['Send money', 'Confirm'].map((label, index) => (
              <div
                key={label}
                className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}
              >
                <b>{step > index + 1 ? '✓' : index + 1}</b>
                {label}
              </div>
            ))}
          </div>
        )}
        <div className="finance-modal-cols">
          <div className="finance-modal-body">
            {step === 1 && (
              <>
                <p className="finance-kicker">1 · Choose how you’ll pay</p>
                <div
                  className="finance-wallet-options"
                  role="radiogroup"
                  aria-label="Payment method"
                >
                  {(Object.keys(wallets) as Wallet[]).map((key) => (
                    <label key={key} className={method === key ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="wallet"
                        checked={method === key}
                        onChange={() => setMethod(key)}
                      />
                      <span className="finance-wallet-check" />
                      <strong>{wallets[key].label}</strong>
                      <small>Send money</small>
                    </label>
                  ))}
                </div>
                <p className="finance-kicker finance-send-heading">2 · Send the money</p>
                <div className="finance-send" aria-live="polite">
                  {wallet ? (
                    <div className="finance-qr">
                      <QR text={wallet.number} size={196} />
                      <small>Scan in {wallet.label}</small>
                    </div>
                  ) : (
                    <div className="finance-qr finance-qr-lock">
                      <QR text="locked-preview" size={196} />
                      <b>Locked</b>
                      <small>
                        Pick bKash or Nagad
                        <br />
                        to reveal the QR
                      </small>
                    </div>
                  )}
                  <div className="finance-send-info">
                    {wallet ? (
                      <>
                        <div className="finance-copy-row">
                          <span>
                            <small>
                              {wallet.label} number · {wallet.account}
                            </small>
                            <strong>{wallet.number.replace(/^(\d{5})(\d{6})$/, '$1-$2')}</strong>
                          </span>
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => navigator.clipboard.writeText(wallet.number)}
                          >
                            Copy
                          </button>
                        </div>
                        <div className="finance-copy-row">
                          <span>
                            <small>Amount to send</small>
                            <strong>{sum}</strong>
                          </span>
                          {!gift && (
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => navigator.clipboard.writeText(String(invoice.amount))}
                            >
                              Copy
                            </button>
                          )}
                        </div>
                        <ol>
                          <li>
                            Open the <b>{wallet.label}</b> app and tap <b>Scan QR</b> or{' '}
                            <b>Send Money</b>.
                          </li>
                          <li>
                            Check the number, enter <b>{sum}</b> and confirm with your PIN.
                          </li>
                          <li>
                            Note the <b>Transaction ID</b> from the SMS, then continue.
                          </li>
                        </ol>
                      </>
                    ) : (
                      <>
                        <div className="finance-copy-row finance-copy-lock">
                          <span>
                            <small>Wallet number</small>
                            <strong>••••• ••••••</strong>
                          </span>
                          <button type="button" className="btn sm" disabled>
                            Copy
                          </button>
                        </div>
                        <div className="finance-copy-row finance-copy-lock">
                          <span>
                            <small>Amount to send</small>
                            <strong>{sum}</strong>
                          </span>
                          <button type="button" className="btn sm" disabled>
                            Copy
                          </button>
                        </div>
                        <p className="finance-copy">
                          Choose a method above and the club’s wallet number and QR code unlock
                          here.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {wallet && (
                  <div className="finance-note-box">
                    <strong>Use “Send Money”.</strong> Payments with a different amount or from
                    another number may need manual checking.
                  </div>
                )}
              </>
            )}
            {step === 2 && wallet && (
              <div>
                <label className="finance-field">
                  <span>Your {wallet.label} number (sent from)</span>
                  <input
                    className="input mono"
                    value={sender}
                    onChange={(event) => setSender(event.target.value)}
                    inputMode="numeric"
                    placeholder="01XXXXXXXXX"
                  />
                </label>
                <label className="finance-field">
                  <span>Transaction ID</span>
                  <input
                    className="input mono"
                    value={trx}
                    onChange={(event) => setTrx(event.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    placeholder="BK3L9T5RP2"
                  />
                </label>
                <label className="finance-field">
                  <span>Amount you sent</span>
                  <div className="finance-amount">
                    <span>৳</span>
                    <input
                      className="input mono"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                    />
                  </div>
                </label>
                {error && (
                  <p className="finance-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}
            {step === 3 && wallet && (
              <div className="finance-done">
                <div>✓</div>
                <h3>{gift ? 'Thank you' : 'Payment submitted'}</h3>
                <p>
                  The Treasurer will check it against the {wallet.label} statement within 24 hours.
                  {!gift && ' Your receipt will appear in Payment history once verified.'}
                </p>
              </div>
            )}
          </div>
          {step < 3 && (
            <aside className="finance-modal-side">
              <small>Paying for</small>
              <dl>
                {!gift && (
                  <div>
                    <dt>Invoice</dt>
                    <dd>{invoice.id}</dd>
                  </div>
                )}
                <div>
                  <dt>Description</dt>
                  <dd>{invoice.label}</dd>
                </div>
                {!gift && (
                  <div>
                    <dt>Due</dt>
                    <dd>{dateLabel(invoice.due, true)}</dd>
                  </div>
                )}
                {wallet && (
                  <div>
                    <dt>Method</dt>
                    <dd>{wallet.label}</dd>
                  </div>
                )}
              </dl>
              <div className="finance-modal-total">
                <small>Total</small>
                <strong>{gift ? (amount ? tk(Number(amount)) : '—') : tk(invoice.amount)}</strong>
              </div>
            </aside>
          )}
        </div>
        <footer className="finance-modal-foot">
          {step !== 3 && (
            <button
              type="button"
              className="btn sm line"
              onClick={step === 1 ? onClose : () => setStep(step - 1)}
            >
              {step === 1 ? 'Cancel' : '← Back'}
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn sm" disabled={!method} onClick={() => setStep(2)}>
              I’ve sent it →
            </button>
          )}
          {step === 2 && (
            <button type="button" className="btn sm" onClick={() => void submit()}>
              {gift ? 'Send contribution' : 'Submit payment'}
            </button>
          )}
          {step === 3 && (
            <button type="button" className="btn sm" onClick={onClose}>
              Done
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/** President and Secretary set what each invoice costs; payments submitted afterwards use the new amount. */
function Fees() {
  const { s, act } = useStore();
  const fees = feesOf(s.kv);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const rows = [
    ['term', 'Member dues', 'Every 3 months from the month a member joined'],
    ['post', 'Post dues', 'Every 3 months from the month a member took a post'],
  ] as const;
  return (
    <section className="finance-panel">
      <header>
        <span>Dues amounts</span>
        <small>0 means no fee · event fees are set on each event</small>
      </header>
      {rows.map(([kind, label, hint]) => {
        const v = draft[kind] ?? String(fees[kind]);
        return (
          <article className="finance-invoice" key={kind}>
            <div>
              <h3>{label}</h3>
              <p className="finance-mono">{hint}</p>
            </div>
            <div className="finance-invoice-action">
              <div className="finance-amount">
                <span>৳</span>
                <input
                  className="input mono"
                  aria-label={`${label} per 3 months`}
                  value={v}
                  inputMode="numeric"
                  onChange={(e) =>
                    setDraft({ ...draft, [kind]: e.target.value.replace(/\D/g, '') })
                  }
                />
              </div>
              <button
                className="btn sm"
                disabled={v === '' || +v === fees[kind]}
                onClick={() => void act('setFee', { kind, amount: +v })}
              >
                Save
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default function Finance() {
  const { s, me, fundTotal, term } = useStore();
  // 'dues' and 'transparency' are for everyone; officer tabs depend on the role's capabilities.
  const officer = officerTabs(s.roles);
  const [tab, setTab] = useState('dues');
  const [paymentInvoice, setPaymentInvoice] = useState<{
    id: string;
    label: string;
    amount: number;
    due: string;
  } | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const syncTab = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      setTab(h === 'transparency' || officer.includes(h) ? h : 'dues');
    };
    syncTab();
    window.addEventListener('hashchange', syncTab);
    return () => window.removeEventListener('hashchange', syncTab);
    // `officer` follows the role, which only changes with a fresh page load.
  }, []);
  const changeTab = (next: string) => {
    setTab(next);
    history.replaceState(null, '', '#' + encodeURIComponent(next));
  };
  const invoices = me.system ? [] : s.dues;
  const alumni = s.roles.includes('alumni'),
    setsFee = canFully(s.roles, 'finance.fee');
  const payments = Object.values(s.pay)
    .filter((p) => p.status !== 'waived')
    .sort((a, b) => b.at.localeCompare(a.at));
  const owed = invoices.filter((invoice) => owes(s.pay, invoice.id));
  const pending = payments.filter((payment) => payment.status === 'pending');
  const verified = payments.filter((payment) => payment.status === 'verified');
  const next = invoices
    .filter((invoice) => owes(s.pay, invoice.id))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const ledger = term.expenses;
  const categories = useMemo(() => {
    const total = term.categories.reduce((sum, c) => sum + c.amount, 0) || 1;
    return term.categories.map((c) => ({
      name: c.cat,
      value: c.amount,
      percent: Math.round((c.amount / total) * 100),
    }));
  }, [term.categories]);
  const flowMax = Math.max(1, ...term.flow.flatMap((m) => [m.in, m.out]));
  const filteredLedger = ledger.filter((item) =>
    `${item.what} ${item.cat} ${item.date}`.toLowerCase().includes(query.toLowerCase()),
  );
  const hero = officer.includes(tab) ? (
    <>
      {tab}
      <span className="accent">.</span>
    </>
  ) : tab === 'transparency' ? (
    <>
      Where the money goes<span className="accent">.</span>
    </>
  ) : owed.length ? (
    <>
      You owe{' '}
      <span className="accent">{tk(owed.reduce((sum, invoice) => sum + invoice.amount, 0))}.</span>
    </>
  ) : pending.length ? (
    <>
      Payment sent<span className="accent">.</span> <small>Awaiting verification.</small>
    </>
  ) : alumni ? (
    <>
      Back the club<span className="accent">.</span>
    </>
  ) : (
    <>
      You’re all paid up<span className="accent">.</span>
    </>
  );
  const receiptPayment = receipt
    ? payments.find((payment) => String(payment.id) === receipt)
    : null;

  return (
    <Page title={hero}>
      <div className="finance-page">
        <div className="finance-tabs" role="tablist" aria-label="Finance sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'dues'}
            className={tab === 'dues' ? 'active' : ''}
            onClick={() => changeTab('dues')}
          >
            My dues
          </button>
          {officer.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'active' : ''}
              onClick={() => changeTab(t)}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'transparency'}
            className={tab === 'transparency' ? 'active' : ''}
            onClick={() => changeTab('transparency')}
          >
            Transparency
          </button>
        </div>
        {tab === 'dues' ? (
          <div className="finance-content">
            <div className="finance-stats">
              <div>
                <small>Outstanding</small>
                <b className={owed.length ? 'blue' : 'green'}>
                  {tk(owed.reduce((sum, invoice) => sum + invoice.amount, 0))}
                </b>
                <small>
                  {pending.length
                    ? `${pending.length} payment${pending.length === 1 ? '' : 's'} awaiting verification`
                    : owed.length
                      ? `${owed.length} invoice${owed.length === 1 ? '' : 's'} open`
                      : 'Nothing due'}
                </small>
              </div>
              <div>
                <small>{alumni ? 'Given so far' : 'Paid so far'}</small>
                <b>{tk(verified.reduce((sum, payment) => sum + payment.amount, 0))}</b>
                <small>
                  {verified.length} verified payment{verified.length === 1 ? '' : 's'}
                </small>
              </div>
              <div>
                <small>Next deadline</small>
                <b>{next ? dateLabel(next.due) : '—'}</b>
                <small className={next && daysUntil(next.due) < 0 ? 'red' : ''}>
                  {next
                    ? daysUntil(next.due) < 0
                      ? `Overdue by ${-daysUntil(next.due)} days`
                      : `${daysUntil(next.due)} days left`
                    : 'All clear'}
                </small>
              </div>
            </div>
            {alumni && (
              <section className="finance-panel">
                <header>
                  <span>Contribute</span>
                  <small>Any amount</small>
                </header>
                <article className="finance-invoice">
                  <div>
                    <h3>Support the club</h3>
                    <p className="finance-mono">No fixed amount, no invoice.</p>
                  </div>
                  <div className="finance-invoice-action">
                    <button
                      className="btn sm finance-pay-btn"
                      onClick={() =>
                        setPaymentInvoice({ id: 'GIFT', label: CONTRIBUTION, amount: 0, due: '' })
                      }
                    >
                      <span>Contribute</span>
                      <b aria-hidden="true">→</b>
                    </button>
                  </div>
                </article>
              </section>
            )}
            {setsFee && <Fees />}
            <section className="finance-panel">
              <header>
                <span>Invoices</span>
                <small>
                  {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
                </small>
              </header>
              {invoices.length ? (
                invoices.map((invoice) => {
                  const payment = s.pay[invoice.id];
                  const canPay = owes(s.pay, invoice.id);
                  const invoiceState =
                    payment?.status === 'verified' || payment?.status === 'waived'
                      ? 'paid'
                      : payment?.status === 'pending'
                        ? 'pending'
                        : daysUntil(invoice.due) < 0
                          ? 'over'
                          : '';
                  return (
                    <article className={`finance-invoice ${invoiceState}`} key={invoice.id}>
                      <div>
                        <h3>{invoice.label}</h3>
                        <p>
                          <StatusTag status={payment?.status ?? 'due'} due={invoice.due} />{' '}
                          <span className="finance-mono">
                            {invoice.id} · Due {dateLabel(invoice.due)}
                          </span>
                        </p>
                      </div>
                      <div className="finance-invoice-action">
                        <strong>{tk(invoice.amount)}</strong>
                        {canPay ? (
                          <button
                            className="btn sm finance-pay-btn"
                            onClick={() => setPaymentInvoice(invoice)}
                          >
                            <span>Pay {tk(invoice.amount)}</span>
                            <b aria-hidden="true">→</b>
                          </button>
                        ) : (
                          <small>
                            {payment?.status === 'pending' ? 'Being checked' : 'Settled'}
                          </small>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="finance-empty">No invoices right now.</p>
              )}
            </section>
            <section className="finance-panel">
              <header>
                <span>Payment history</span>
                <small>
                  {payments.length} payment{payments.length === 1 ? '' : 's'}
                </small>
              </header>
              {payments.length ? (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>For</th>
                        <th>Date</th>
                        <th>Via</th>
                        <th>Trx ID</th>
                        <th className="right">Amount</th>
                        <th className="right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="finance-mono">RCP-{payment.id}</td>
                          <td>{payment.label}</td>
                          <td>
                            {new Date(payment.at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td>{payment.via}</td>
                          <td className="finance-mono">{payment.trx}</td>
                          <td className="right finance-mono">{tk(payment.amount)}</td>
                          <td className="right">
                            {payment.status === 'verified' && payment.label !== CONTRIBUTION ? (
                              <button
                                className="finance-link"
                                onClick={() => setReceipt(String(payment.id))}
                              >
                                Receipt ↗
                              </button>
                            ) : (
                              <StatusTag status={payment.status} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="finance-empty">
                  No payments yet. Your receipts will appear here once the Treasurer verifies a
                  payment.
                </p>
              )}
              {receiptPayment && (
                <Receipt
                  id={`RCP-${receiptPayment.id}`}
                  label={receiptPayment.label}
                  amount={receiptPayment.amount}
                  date={receiptPayment.at.slice(0, 10)}
                  via={receiptPayment.via}
                  onClose={() => setReceipt(null)}
                />
              )}
            </section>
          </div>
        ) : officer.includes(tab) ? (
          <OfficerPanel tab={tab} />
        ) : (
          <div className="finance-content">
            <div className="finance-sample">
              <span className="tag">Partly sample</span>
              <span>
                Everything here is real except the fund's opening balance, which is sample data
              </span>
            </div>
            <div className="finance-transparency-grid">
              <section className="finance-balance">
                <small>Club fund balance</small>
                <strong>{tk(fundTotal)}</strong>
                <div>
                  <span>Incoming this term</span>
                  <b className="green">+{tk(term.incoming)}</b>
                </div>
                <div>
                  <span>Spent this term</span>
                  <b className="red">−{tk(term.spent)}</b>
                </div>
                <i aria-hidden>৳</i>
              </section>
              <section className="finance-panel">
                <header>
                  <span>Money in vs. money out</span>
                  <small>Last 6 months</small>
                </header>
                <div className="finance-chart">
                  {term.flow.map((m) => (
                    <div className="finance-chart-col" key={m.month}>
                      <div>
                        <i
                          style={{ height: `${(m.in / flowMax) * 100}%` }}
                          title={`In: ${tk(m.in)}`}
                        />
                        <i
                          className="out"
                          style={{ height: `${(m.out / flowMax) * 100}%` }}
                          title={`Out: ${tk(m.out)}`}
                        />
                      </div>
                      <small>{fmtDate(m.month + '-01', { month: 'short' })}</small>
                    </div>
                  ))}
                </div>
                <div className="finance-legend">
                  <span>
                    <i />
                    Money in
                  </span>
                  <span>
                    <i />
                    Money out
                  </span>
                </div>
              </section>
            </div>
            <section className="finance-panel">
              <header>
                <span>Spending this term, by category</span>
                <small>{tk(categories.reduce((sum, item) => sum + item.value, 0))}</small>
              </header>
              <div className="finance-categories">
                {categories.length ? (
                  categories.map((item) => (
                    <button
                      type="button"
                      className={query === item.name ? 'selected' : ''}
                      key={item.name}
                      onClick={() => setQuery(query === item.name ? '' : item.name)}
                    >
                      <span>{item.name}</span>
                      <i>
                        <b style={{ width: `${item.percent}%` }} />
                      </i>
                      <small>{item.value ? tk(item.value) : ''}</small>
                      <small>{item.percent}%</small>
                    </button>
                  ))
                ) : (
                  <p className="finance-empty">No approved expenses this term.</p>
                )}
              </div>
              <p className="finance-note">Select a category to filter the ledger below.</p>
            </section>
            <section className="finance-panel">
              <header>
                <span>All expenses</span>
                <small>{filteredLedger.length} shown</small>
              </header>
              <div className="finance-tools">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  type="search"
                  placeholder="Search expenses"
                  aria-label="Search expenses"
                />
                <button
                  type="button"
                  className={!query ? 'active' : ''}
                  onClick={() => setQuery('')}
                >
                  All categories
                </button>
              </div>
              <div className="finance-table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Approved by</th>
                      <th className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((item, i) => (
                      <tr key={i}>
                        <td className="finance-mono">{fmtDate(item.date)}</td>
                        <td>
                          <b>{item.what}</b>
                        </td>
                        <td>{item.cat}</td>
                        <td>{item.by ?? '—'}</td>
                        <td className="right finance-mono">{tk(item.amount)}</td>
                      </tr>
                    ))}
                    {!filteredLedger.length && (
                      <tr>
                        <td colSpan={5} className="finance-empty">
                          {ledger.length ? 'No expenses match.' : 'No approved expenses this term.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
      {paymentInvoice && (
        <PaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} />
      )}
    </Page>
  );
}
