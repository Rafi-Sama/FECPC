import assert from 'node:assert/strict';
import { test } from 'node:test';
import { can, canFully, grantOf, isAdmin } from '../src/capabilities.ts';
import { roles, isCommittee } from '../src/roles.ts';

test("matrix matches the spec's risky cells", () => {
  assert.equal(can('member', 'payments.verify'), false);
  assert.equal(grantOf('member', 'payments.verify'), 'none');

  assert.equal(can('president', 'payments.verify'), 'view');
  assert.equal(grantOf('president', 'payments.verify'), 'view');
  assert.equal(canFully('president', 'payments.verify'), false);

  assert.equal(can('treasurer', 'payments.verify'), true);
  assert.equal(grantOf('treasurer', 'payments.verify'), 'full');

  assert.equal(can('treasurer', 'expense.approve'), 'propose');
  assert.equal(grantOf('treasurer', 'expense.approve'), 'propose');

  assert.equal(can('member', 'teams.oversee'), false);
  assert.equal(can('cp_head', 'teams.oversee'), true);

  assert.equal(can('secretary', 'audit.view'), false);

  // feed moderation and the contest-day scoreboard are officer powers, never a plain member's
  for (const r of ['member', 'alumni'] as const) {
    assert.equal(can(r, 'feed.moderate'), false);
    assert.equal(can(r, 'contest.run'), false);
  }
  assert.equal(can('secretary', 'feed.moderate'), true);
  assert.equal(can('cp_head', 'contest.run'), true);

  for (const r of roles) {
    assert.equal(can(r, 'profile.own'), true);
    assert.equal(can(r, 'profile.editOwn'), true);
  }

  assert.deepEqual(
    roles.filter((r) => canFully(r, 'roles.assign')),
    ['president', 'super_admin'],
  );
  assert.deepEqual(
    roles.filter((r) => canFully(r, 'member.makeAlumni')),
    ['president', 'super_admin'],
  );
  assert.deepEqual(
    roles.filter((r) => canFully(r, 'member.deactivate')),
    ['president', 'super_admin'],
  );
  assert.deepEqual(
    roles.filter((r) => canFully(r, 'alumni.job.post')),
    ['alumni', 'president', 'super_admin'],
  );
});

test('roles classification and admin gates', () => {
  assert.equal(isCommittee('member'), false);
  assert.equal(isCommittee('alumni'), false);
  assert.equal(isCommittee('treasurer'), true);
  assert.equal(isCommittee('secretary'), true);
  assert.equal(isCommittee('president'), true);
  assert.equal(isCommittee('super_admin'), true);

  assert.equal(isAdmin('member'), false);
  assert.equal(isAdmin('treasurer'), true); // holds data.export
  assert.equal(isAdmin('secretary'), true); // holds application.approve and data.export
  assert.equal(isAdmin('president'), true);
  assert.equal(isAdmin('super_admin'), true);
});

test('several roles take the strongest grant, and posts never grant rank', async () => {
  const { postableRoles } = await import('../src/roles.ts');
  assert.equal(can(['member', 'treasurer'], 'payments.verify'), true);
  assert.equal(can(['president', 'treasurer'], 'payments.verify'), true);
  assert.equal(can(['member', 'cp_head'], 'teams.oversee'), true);
  assert.equal(can([], 'profile.own'), false);
  assert.equal(isCommittee(['member', 'secretary']), true);
  assert.equal(isCommittee(['member', 'alumni']), false);
  assert.equal(isAdmin(['member', 'secretary']), true);
  assert.deepEqual(
    roles.filter((r) => !postableRoles.includes(r as never)),
    ['president', 'super_admin'],
  );
  for (const r of postableRoles) assert.equal(canFully(r, 'roles.assign'), false);
});
