'use client';
import { useEffect, useState } from 'react';
import type { CfRound, ClubRounds } from '@fecpc/contracts';

// Members' recent rated rounds are not in the roster (they are most of its weight); the Arena loads them once.
let once: Promise<Map<string, CfRound[]>> | null = null;
const load = () =>
  (once ??= fetch('/api/members', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'clubRounds' }),
  })
    .then((r) => (r.ok ? (r.json() as Promise<ClubRounds[]>) : []))
    .then((rows) => new Map(rows.map((x) => [x.id, x.cf_contests])))
    .catch(() => ((once = null), new Map())));

/** Every member's last rated Codeforces rounds by member id; empty until loaded. */
export function useClubRounds() {
  const [rounds, setRounds] = useState<Map<string, CfRound[]>>(() => new Map());
  useEffect(() => void load().then(setRounds), []);
  return rounds;
}
