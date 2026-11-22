import assert from 'node:assert/strict';
import { test } from 'node:test';
import { duesFor, feesOf, periods } from '../src/dues.ts';

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
