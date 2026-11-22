import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkProfile, profileDiff } from '../src/profile.ts';

test('checkProfile cleans present fields, empties optional ones, and refuses bad values', () => {
  const r = checkProfile({
    name: ' Nadia  Rahman ',
    dept: 'cse',
    batch: '27',
    phone: '017-1234 5678',
    github_url: 'https://github.com/nadia',
    linkedin_url: '',
    skills: [' DP ', 'DP', 'Graphs'],
  });
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.value, {
    name: 'Nadia Rahman',
    dept: 'CSE',
    batch: 27,
    phone: '01712345678',
    github_url: 'https://github.com/nadia',
    linkedin_url: null,
    skills: ['DP', 'Graphs'],
  });
  const bad = checkProfile({
    name: '',
    batch: 'x',
    github_url: 'https://evil.example/github.com/x',
    linkedin_url: 'javascript:alert(1)',
    avatar_url: 'data:text/html;base64,AA',
    cf_handle: 'a',
  });
  assert.deepEqual(Object.keys(bad.errors).sort(), [
    'avatar_url',
    'batch',
    'cf_handle',
    'github_url',
    'linkedin_url',
    'name',
  ]);
});

test('profileDiff keeps only changed fields', () => {
  assert.deepEqual(
    profileDiff(
      { name: 'A B', phone: null, skills: ['b', 'a'], batch: 27 },
      { name: 'A B', phone: '01712345678', skills: ['a', 'b'], batch: 27 },
    ),
    { phone: null },
  );
});
