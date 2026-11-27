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

/** When a period's bill is due: the first day of its second month. */
export const dueOf = (period: string) => `${ym(idx(period) + 1)}-01`;

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
          due: dueOf(p),
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

/** Mobile wallets members can pay into. Each sends a transaction ID by SMS, which the Treasurer checks. */
export const WALLET_PROVIDERS = ['bKash', 'Nagad', 'Rocket', 'Upay'] as const;
export type WalletProvider = (typeof WALLET_PROVIDERS)[number];
/** One account the club takes payments on. Inactive ones stay listed for officers but are hidden from members. */
export type PayMethod = {
  id: string;
  provider: WalletProvider;
  number: string;
  /** Who holds it, e.g. "Personal · Club Treasurer". */
  account: string;
  active: boolean;
};
/** Club setting key (`kv:<key>`) holding the payment methods as JSON. */
export const WALLETS_KEY = 'wallets';
export const DEFAULT_WALLETS: PayMethod[] = [
  {
    id: 'bkash',
    provider: 'bKash',
    number: '01700000000',
    account: 'Personal · Club Treasurer',
    active: true,
  },
  {
    id: 'nagad',
    provider: 'Nagad',
    number: '01800000000',
    account: 'Personal · Club Treasurer',
    active: true,
  },
];
export const WALLET_COLOR: Record<WalletProvider, string> = {
  bKash: '#e2136e',
  Nagad: '#f6921e',
  Rocket: '#8c3494',
  Upay: '#0f4c9c',
};

/** Checks a list of payment methods; returns the cleaned list or what is wrong with it. */
export function cleanWallets(v: unknown): PayMethod[] | string {
  if (!Array.isArray(v) || v.length > 10) return 'Add between 1 and 10 payment methods.';
  const out: PayMethod[] = [];
  for (const [n, w] of v.entries()) {
    const at = `Method ${n + 1}`;
    const x = (w ?? {}) as Record<string, unknown>;
    const provider = WALLET_PROVIDERS.find((p) => p === x.provider);
    if (!provider) return `${at}: pick ${WALLET_PROVIDERS.join(', ')}.`;
    const number = String(x.number ?? '').replace(/[\s-]/g, '');
    if (!/^01[3-9]\d{8}$/.test(number)) return `${at}: the number must be 11 digits, starting 01.`;
    const account = String(x.account ?? '').trim();
    if (account.length < 2 || account.length > 60)
      return `${at}: say whose account it is (2 to 60 characters).`;
    const id =
      typeof x.id === 'string' && /^[a-z0-9-]{1,40}$/.test(x.id)
        ? x.id
        : `${provider}-${number}`.toLowerCase();
    if (out.some((o) => o.id === id || (o.provider === provider && o.number === number)))
      return `${at} repeats another method.`;
    out.push({ id, provider, number, account, active: x.active !== false });
  }
  if (!out.some((w) => w.active)) return 'Keep at least one method active, or members cannot pay.';
  return out;
}

/** The club's payment methods from the settings, or the defaults. */
export function walletsOf(kv: Record<string, unknown>): PayMethod[] {
  try {
    const raw = kv[WALLETS_KEY];
    const list = cleanWallets(typeof raw === 'string' ? JSON.parse(raw) : raw);
    return typeof list === 'string' ? DEFAULT_WALLETS : list;
  } catch {
    return DEFAULT_WALLETS;
  }
}

/** One member's dues standing, for finance officers. `since`: the due date of the oldest overdue bill. */
export type DuesMember = {
  id: string;
  name: string;
  no: string | null;
  batch: string | null;
  bills: { id: string; status: 'paid' | 'waiting' | 'unpaid'; due: string }[];
  paid: number;
  waiting: number;
  unpaid: number;
  overdue: number;
  owed: number;
  since: string | null;
};
