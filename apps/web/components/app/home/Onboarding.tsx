'use client';
import Link from 'next/link';
import { useStore } from '../Store';
import { myInvoices, owes, sheet } from '@fecpc/content/member-area';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export function Onboarding() {
  const { s } = useStore();
  const starter = s.solved.filter((id) => sheet.some((p) => p.id === id)).length;
  const steps: [string, boolean, string][] = [
    ['Link your Codeforces handle', !!s.handle, '/app/profile'],
    ['Send your mentor a check-in', s.sent.includes('checkin'), '/app/learn'],
    ['Solve three starter problems', starter >= 3, '/app/sheets'],
    ['Clear your dues', myInvoices(s.reg).every((i) => !owes(s.pay, i.id)), '/app/finance'],
    ['Register for an event', s.reg.length > 0, '/app/events'],
  ];
  const n = steps.filter((x) => x[1]).length;
  if (n === steps.length || s.role !== 'member') return null; // done, or not a newcomer
  return (
    <section className="panel c6">
      <div className="row between">
        <p className="label">Onboarding</p>
        <span className="mono acc">
          {n}/{steps.length}
        </span>
      </div>
      <div className="meter" style={css({ '--v': `${(n / steps.length) * 100}%` })}>
        <i />
      </div>
      <ul className="list">
        {steps.map(([t, d, href]) => (
          <li key={t}>
            <span className={d ? 'ok' : 'dim'}>{d ? '✓' : '○'}</span>
            <span
              className="grow"
              style={{ textDecoration: d ? 'line-through' : 'none', opacity: d ? 0.6 : 1 }}
            >
              {t}
            </span>
            {!d && (
              <Link className="btn xs line" href={href}>
                Go
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
