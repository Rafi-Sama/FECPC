import assert from 'node:assert/strict';
import { test } from 'node:test';
import { earned, level, quests, XP, type Earn } from '../src/xp.ts';

const base: Earn = {
  base: { solved: 9, done: 1 },
  solved: Array(9).fill('x'),
  verified: [],
  done: ['r1'],
  present: [],
  checkin: false,
  kudos: [],
  reg: [],
  pay: {},
  votes: {},
  read: [],
  posts: 0,
};

test('xp: base state earns nothing, and actions add up', () => {
  assert.equal(earned(base), 0);
  assert.equal(earned({ ...base, checkin: true }), XP.checkin);
  const all3 = {
    ...base,
    solved: [...base.solved, 'y'],
    verified: ['y'],
    done: [...base.done, 'r2'],
    kudos: ['f1'],
  };
  assert.equal(earned(all3), XP.solve + XP.resource + XP.kudos + XP.quest);
  // a tick Codeforces has not confirmed is tracked but earns nothing, and does not finish the quest
  const unverified = { ...all3, verified: [] };
  assert.equal(earned(unverified), XP.resource + XP.kudos);
  assert.equal(quests(unverified)[0]!.done, false);
  assert.deepEqual(level(3100), { lv: 3, into: 100, title: 'Grinder' });
});

test('xp: a payment earns only once verified; a new member with no base starts at zero', () => {
  assert.equal(
    earned({ ...base, pay: { a: { status: 'pending' }, b: { status: 'rejected' } } }),
    0,
  );
  assert.equal(earned({ ...base, pay: { a: { status: 'verified' } } }), XP.pay);
  const fresh = { ...base, base: { solved: 0, done: 0 }, solved: [], done: [] };
  assert.equal(earned(fresh), 0);
  assert.equal(quests({ ...fresh, solved: ['4A'], verified: ['4A'] })[0]!.done, true);
  assert.deepEqual(level(-50), { lv: 1, into: 0, title: 'Rookie' }); // never negative after spending
});

test('xp: community redesign actions award XP and election votes award nothing', () => {
  assert.equal(earned({ ...base, votes: { p1: 'Saturday', election: 'sadia' } }), XP.vote);
  assert.equal(
    earned({
      ...base,
      feedPosts: 2,
      feedUpvotes: 3,
      ideasCount: 1,
      acceptedInterests: 2,
      kudosReceived: 4,
    }),
    2 * XP.feedPost +
      3 * XP.feedUpvote +
      1 * XP.idea +
      2 * XP.interestAccepted +
      4 * XP.kudosReceived,
  );
  assert.equal(XP.kudosReceived, 2);
});
