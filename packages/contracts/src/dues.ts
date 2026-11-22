// What a member owes. Computed on the server from real records (join month, post month, event registrations)
// and sent as `s.dues`; payments are checked against the same list.

/** One bill. `id` is stable: `TERM-YYYY-MM` / `POST-YYYY-MM` (the period's first month) or `EV-<event id>`. */
export type Due = {
  id: string;
  kind: 'term' | 'post' | 'event';
  label: string;
  amount: number;
  /** YYYY-MM-DD */
  due: string;
};

/** The first month the club bills. Periods that ended before it are never owed. */
export const BILLING_START = '2026-11';
/** Months per billing period, for term dues and post dues alike. */
export const PERIOD_MONTHS = 3;
/** Club setting keys (`kv:<key>`); the President or Secretary changes them. */
export const FEE_KEYS = { term: 'fee:term', post: 'fee:post' } as const;
const DEFAULT_FEES = { term: 300, post: 0 };

/** Current term and post fees from the club settings. 0 means no fee. */
export const feesOf = (kv: Record<string, unknown>) => {
  const v = (k: keyof typeof FEE_KEYS) => {
    const n = Number(kv[FEE_KEYS[k]]);
    return kv[FEE_KEYS[k]] !== undefined && Number.isInteger(n) && n >= 0 ? n : DEFAULT_FEES[k];
  };
  return { term: v('term'), post: v('post') };
};

const idx = (ym: string) => +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1;
const ym = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mon = (i: number) => `${MON[i % 12]} ${Math.floor(i / 12)}`;

/**
 * Start months (YYYY-MM) of the 3-month periods anchored on `from`'s month: from the period that contains
 * BILLING_START (or the first one, if `from` is later) through the one that contains `today`.
 */
export function periods(from: string, today: string): string[] {
  const a = idx(from),
    now = idx(today);
  const out: string[] = [];
  for (let k = Math.max(0, Math.floor((idx(BILLING_START) - a) / PERIOD_MONTHS)); ; k++) {
    const s = a + k * PERIOD_MONTHS;
    if (s > now) return out;
    out.push(ym(s));
  }
}

/** The bills for one member, oldest first. Alumni owe no term or post dues; they contribute instead. */
export function duesFor(
  u: { joined: string; postSince: string | null; alumni: boolean },
  fees: { term: number; post: number },
  events: { id: string; title: string; fee: number; date: string }[],
  today: string,
): Due[] {
  const span = (kind: 'term' | 'post', from: string | null, what: string, amount: number): Due[] =>
    !from || !amount || u.alumni
      ? []
      : periods(from, today).map((p) => ({
          id: `${kind.toUpperCase()}-${p}`,
          kind,
          label: `${what}, ${mon(idx(p))} – ${mon(idx(p) + PERIOD_MONTHS - 1)}`,
          amount,
          due: `${ym(idx(p) + 1)}-01`,
        }));
  return [
    ...span('term', u.joined, 'Member dues', fees.term),
    ...span('post', u.postSince, 'Post dues', fees.post),
    ...events
      .filter((e) => e.fee > 0)
      .map((e) => ({
        id: `EV-${e.id}`,
        kind: 'event' as const,
        label: `${e.title} registration`,
        amount: e.fee,
        due: e.date,
      })),
  ];
}
