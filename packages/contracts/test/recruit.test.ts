import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkApplicant,
  checkForm,
  DEFAULT_FORM,
  photoOk,
  readApplicantCsv,
} from '../src/recruit.ts';

const ok = {
  name: '  Nadia   Rahman ',
  sid: '2026-331-042',
  dept: 'cse',
  email: 'Nadia@Example.com',
  phone: '017-1234 5678',
  photo: 'data:image/webp;base64,' + btoa('RIFF\0\0\0\0WEBPVP8 '),
};

test('checkApplicant cleans valid input and flags each bad field', () => {
  const r = checkApplicant(ok, DEFAULT_FORM);
  assert.deepEqual(r.errors, {});
  assert.equal(r.value.name, 'Nadia Rahman');
  assert.equal(r.value.dept, 'CSE');
  assert.equal(r.value.email, 'nadia@example.com');
  assert.equal(r.value.phone, '01712345678');
  const bad = checkApplicant(
    { name: '<b>x', sid: '!', email: 'x', phone: '12', photo: 'data:text/html;base64,AA' },
    DEFAULT_FORM,
  );
  assert.deepEqual(Object.keys(bad.errors).sort(), [
    'dept',
    'email',
    'name',
    'phone',
    'photo',
    'sid',
  ]);
  assert.equal(checkApplicant({ ...ok, photo: '' }, DEFAULT_FORM).errors.photo !== undefined, true);
  assert.deepEqual(checkApplicant({ ...ok, photo: '' }, DEFAULT_FORM, { photo: false }).errors, {});
});

test('checkApplicant keeps only answers to questions on the form, labelled', () => {
  const form = { cf: false, why: false, questions: [{ id: 'q1', label: 'Laptop?', long: false }] };
  const r = checkApplicant(
    { ...ok, cf: 'tourist', why: 'hi', answers: { q1: ' yes ', q9: 'x' } },
    form,
  );
  assert.deepEqual(
    [r.value.cf, r.value.why, r.value.answers],
    ['', '', [{ q: 'Laptop?', a: 'yes' }]],
  );
});

test('checkForm bounds questions and refuses duplicates', () => {
  assert.equal(checkForm({ questions: [{ label: 'ab' }] }).error !== undefined, true);
  assert.equal(
    checkForm({ questions: [{ label: 'Same' }, { label: 'same' }] }).error !== undefined,
    true,
  );
  const f = checkForm({ cf: false, questions: [{ label: 'Why us?', long: true }] });
  assert.equal(f.error, undefined);
  assert.equal(f.value.cf, false);
  assert.match(f.value.questions[0]!.id, /^q[a-z0-9]+$/);
});

test('readApplicantCsv maps headers in any order and flags bad and repeated rows', () => {
  const { missing, rows } = readApplicantCsv(
    '﻿Email,Phone,Full Name,Student ID,Dept\nA@x.com,01712345678,Ana Roy,S-1001,EEE\n\na@x.com,01712345678,Bo,S-1002,EEE\n',
  );
  assert.deepEqual(missing, []);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0]!.errors, {});
  assert.equal(rows[1]!.row, 2);
  assert.ok(rows[1]!.errors.email);
  assert.deepEqual(readApplicantCsv('name,email\n').missing, [
    'Student ID',
    'Department',
    'Phone number',
  ]);
});

test('photoOk: the bytes must be the declared image format', () => {
  const as = (type: string, bytes: string) => `data:image/${type};base64,${btoa(bytes)}`;
  assert.ok(photoOk(as('png', '\x89PNG\r\n\x1a\n')));
  assert.ok(photoOk(as('jpeg', '\xff\xd8\xff\xe0')));
  assert.ok(photoOk(as('webp', 'RIFF\0\0\0\0WEBP')));
  assert.ok(!photoOk(as('png', '<html><script>x</script>')));
  assert.ok(!photoOk(as('webp', 'RIFF\0\0\0\0AVI ')));
  assert.ok(!photoOk('data:image/svg+xml;base64,' + btoa('<svg/>')));
  assert.ok(!photoOk(as('png', '\x89PNG' + 'x'.repeat(100)), 50));
});
