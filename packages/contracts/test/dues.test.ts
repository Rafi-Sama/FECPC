import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanWallets, DEFAULT_WALLETS, duesFor, feesOf, periods, walletsOf } from '../src/dues.ts';

test('periods: every 3 months from the join month, from the one holding the billing start', () => {
  assert.deepEqual(periods('2026-11-20', '2026-11-23'), ['2026-11']);
  assert.deepEqual(periods('2026-11-20', '2027-02-01'), ['2026-11', '2027-02']);
  // Joined long before billing began: only the period containing Nov 2026 onwards.
  assert.deepEqual(periods('2025-09-03', '2027-01-10'), ['2026-09', '2026-12']);
  assert.deepEqual(periods('2027-03-01', '2027-02-28'), []);
});

test('duesFor: term, post and event bills; alumni and zero fees bill nothing', () => {
  const ev = [
    { id: 'hack', title: 'Hack Night', fee: 150, date: '2026-12-05' },
    { id: 'free', title: 'Free talk', fee: 0, date: '2026-12-06' },
  ];
  const d = duesFor(
    { joined: '2026-11-02', postSince: '2026-12-10', alumni: false },
    { term: 300, post: 200 },
    ev,
    '2027-02-15',
  );
  assert.deepEqual(
    d.map((x) => [x.id, x.amount, x.due]),
    [
      ['TERM-2026-11', 300, '2026-12-01'],
      ['TERM-2027-02', 300, '2027-03-01'],
      ['POST-2026-12', 200, '2027-01-01'],
      ['EV-hack', 150, '2026-12-05'],
    ],
  );
  assert.equal(d[0]!.label, 'Member dues, Nov 2026 – Jan 2027');
  const alum = duesFor(
    { joined: '2026-11-02', postSince: null, alumni: true },
    { term: 300, post: 200 },
    ev,
    '2026-11-23',
  );
  assert.deepEqual(
    alum.map((x) => x.id),
    ['EV-hack'],
  );
  assert.deepEqual(
    duesFor(
      { joined: '2026-11-02', postSince: '2026-11-02', alumni: false },
      { term: 0, post: 0 },
      [],
      '2026-11-23',
    ),
    [],
  );
});

test('feesOf: club settings, else defaults; 0 is allowed', () => {
  assert.deepEqual(feesOf({}), { term: 300, post: 0 });
  assert.deepEqual(feesOf({ 'fee:term': '450', 'fee:post': '0' }), { term: 450, post: 0 });
  assert.deepEqual(feesOf({ 'fee:term': 'junk' }), { term: 300, post: 0 });
});

test('payment methods: validated, deduplicated, at least one active', () => {
  const ok = cleanWallets([
    { provider: 'bKash', number: '017-0000 0000', account: 'Treasurer' },
    { provider: 'Rocket', number: '01811111111', account: 'President', active: false },
  ]);
  assert.ok(Array.isArray(ok));
  assert.equal(ok[0]!.number, '01700000000');
  assert.equal(ok[1]!.active, false);
  assert.match(
    String(cleanWallets([{ provider: 'PayPal', number: '01700000000', account: 'x1' }])),
    /pick/,
  );
  assert.match(
    String(cleanWallets([{ provider: 'bKash', number: '123', account: 'Treasurer' }])),
    /11 digits/,
  );
  const dup = { provider: 'bKash', number: '01700000000', account: 'Treasurer' };
  assert.match(String(cleanWallets([dup, dup])), /repeats/);
  assert.match(String(cleanWallets([{ ...dup, active: false }])), /active/);
  // A broken setting never leaves members without a way to pay.
  assert.deepEqual(walletsOf({ wallets: 'not json' }), DEFAULT_WALLETS);
});
