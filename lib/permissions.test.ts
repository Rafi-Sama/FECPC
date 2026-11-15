import assert from "node:assert/strict";
import { test } from "node:test";
import { can, canFully, roles } from "./permissions.ts";

test("matrix matches the spec's risky cells", () => {
  assert.equal(can("member", "payments.verify"), false);
  assert.equal(can("president", "payments.verify"), "view"); // president sees, never verifies
  assert.equal(canFully("president", "payments.verify"), false);
  assert.equal(can("treasurer", "expense.approve"), "propose"); // two-person rule
  assert.equal(canFully("treasurer", "dues.waive"), false);
  assert.equal(can("mentor", "mentees.view"), "scope");
  assert.equal(can("secretary", "audit.view"), false);
  for (const r of roles) assert.equal(can(r, "profile.own"), true);
  assert.deepEqual(roles.filter((r) => canFully(r, "roles.assign")), ["president", "super_admin"]);
});
