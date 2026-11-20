import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GoogleCodeSchema,
  InviteAcceptSchema,
  LoginRequestSchema,
  PasswordChangeSchema,
} from '../src/auth.ts';

test('auth schemas: strict mode rejects unknown keys (mass assignment protection)', () => {
  const extra = { isAdmin: true, role: 'super_admin' };
  assert.throws(
    () => LoginRequestSchema.parse({ email: 'a@example.com', password: 'x', ...extra }),
    /unrecognized_keys/i,
  );
  assert.throws(
    () => InviteAcceptSchema.parse({ token: 'x'.repeat(43), password: 'long-enough-1', ...extra }),
    /unrecognized_keys/i,
  );
  assert.throws(
    () => GoogleCodeSchema.parse({ code: 'c', email: 'a@example.com' }),
    /unrecognized_keys/i,
  );
});

test('auth schemas: emails are normalised; checking a password has no length policy, setting one does', () => {
  assert.equal(
    LoginRequestSchema.parse({ email: '  Tasnim@FECPC.example ', password: 'short' }).email,
    'tasnim@fecpc.example',
  );
  assert.throws(() => LoginRequestSchema.parse({ email: 'a@example.com', password: '' }));
  assert.throws(() => PasswordChangeSchema.parse({ currentPassword: 'x', newPassword: 'short' }));
  assert.throws(() => InviteAcceptSchema.parse({ token: 'x'.repeat(43), password: 'short' }));
  assert.throws(() => InviteAcceptSchema.parse({ token: 'short', password: 'long-enough-1' }));
});
