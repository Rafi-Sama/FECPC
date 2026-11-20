import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PasswordHasher } from '../src/modules/auth/password.ts';

test('PasswordHasher: Generates self-describing scrypt hash and verifies', async () => {
  const pwd = 'TestPassword123!';
  const hash = await PasswordHasher.hash(pwd);

  assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);

  const correct = await PasswordHasher.verify(pwd, hash);
  assert.equal(correct.valid, true);

  const wrong = await PasswordHasher.verify('WrongPassword456!', hash);
  assert.equal(wrong.valid, false);
});

test('PasswordHasher: Legacy format (salt:hash) verifies and flags needsRehash', async () => {
  // Hash a password then convert to legacy format salt:hash
  const pwd = 'LegacyPassword';
  const modernHash = await PasswordHasher.hash(pwd);
  const parts = modernHash.split('$');
  const saltHex = Buffer.from(parts[4]!, 'base64url').toString('hex');
  const keyHex = Buffer.from(parts[5]!, 'base64url').toString('hex');
  const legacyHash = `${saltHex}:${keyHex}`;

  const res = await PasswordHasher.verify(pwd, legacyHash);
  assert.equal(res.valid, true);
  assert.equal(res.needsRehash, true);
});

test('PasswordHasher: Legacy 3-part format (scrypt$salt$derivedKey) verifies and flags needsRehash', async () => {
  // Seed hash for tasnim@fecpc.example / fecpc-dev-2026
  const pwd = 'fecpc-dev-2026';
  const hash =
    'scrypt$3ihkvW1g9aiicqfZCdalyg$aZvbyeeGdVs6bGIETFF4_tzzPu1mA_w-afzaXNvlBCqebhMflDXEa1K3OWq89w0DKQvPOfbnv45ZXs0gGpDZFQ';

  const res = await PasswordHasher.verify(pwd, hash);
  assert.equal(res.valid, true);
  assert.equal(res.needsRehash, true);

  const wrong = await PasswordHasher.verify('wrong-password', hash);
  assert.equal(wrong.valid, false);
});

test('PasswordHasher: Dummy verify completes without exception', async () => {
  await PasswordHasher.dummyVerify();
  assert.ok(true);
});

test('PasswordHasher: Empty or truncated stored hashes never verify', async () => {
  for (const stored of [':', 'aa:', ':bb', 'scrypt$$', 'scrypt$16384$8$1$$', 'scrypt$c2FsdHNhbHQ$'])
    assert.equal((await PasswordHasher.verify('', stored)).valid, false, stored);
});
