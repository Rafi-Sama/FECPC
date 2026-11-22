'use client';
import Link from 'next/link';
import { useStore } from '../Store';
import { useSolved } from '../Judge';
import { owes, sheet } from '@fecpc/content/member-area';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export function Onboarding() {
  const { s } = useStore();
  const { isSolved } = useSolved();
  const starter = sheet.filter((p) => isSolved(p.id)).length;
  const steps: [string, boolean, string][] = [
    ['Link your Codeforces handle', !!s.handle, '/app/profile'],
    ['Solve three starter problems', starter >= 3, '/app/sheets'],
    ['Clear your dues', s.dues.every((i) => !owes(s.pay, i.id)), '/app/finance'],
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
