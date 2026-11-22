'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { SheetProblem } from '@fecpc/contracts';
import { useStore } from '../Store';
import { recheck, useSolved } from '../Judge';

export type Daily = SheetProblem & { tier: 'Easy' | 'Medium' | 'Hard' };

/** Today's three problems, taken from this week's sheet: one per difficulty, a different one each day. */
export function useDaily(): Daily[] {
  const { sheets } = useStore();
  const p = sheets.find((x) => x.kind === 'weekly')?.problems ?? [];
  const d = (new Date().getDay() + 6) % 7; // Monday = 0, in the member's own time
  const band = (tier: Daily['tier'], lo: number, hi: number) => {
    const xs = p.filter((x) => (x.rating ?? 0) >= lo && (x.rating ?? 0) <= hi);
    return xs.length ? [{ ...xs[d % xs.length]!, tier }] : [];
  };
  return [...band('Easy', 0, 1000), ...band('Medium', 1100, 1600), ...band('Hard', 1700, 9999)];
}

/** Solved only when Codeforces says so: "I solved it" asks the judge again and answers "Not yet" otherwise. */
export function SolveCheck({ id, className = 'btn sm' }: { id: string; className?: string }) {
  const { s, syncJudges } = useStore();
  const { synced } = useSolved();
  const [st, setSt] = useState<'idle' | 'busy' | 'no' | 'down'>('idle');
  if (!s.handle)
    return (
      <Link href="/app/profile" className={`${className} line`}>
        Link Codeforces to track
      </Link>
    );
  if (synced.has(id))
    return (
      <button className={`${className} line`} disabled>
        Solved ✓
      </button>
    );
  return (
    <button
      className={`${className} ${st === 'no' ? 'line' : ''}`}
      disabled={st === 'busy'}
      aria-live="polite"
      onClick={async () => {
        setSt('busy');
        const j = await recheck(s.handle);
        if (j?.solved.includes(id)) void syncJudges();
        setSt(!j ? 'down' : j.solved.includes(id) ? 'idle' : 'no');
      }}
    >
      {st === 'busy'
        ? 'Checking…'
        : st === 'no'
          ? 'Not yet · check again'
          : st === 'down'
            ? 'Codeforces is slow · retry'
            : 'I solved it'}
    </button>
  );
}
