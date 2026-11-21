import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, fillTemplate, parseCsv } from '../src/events.ts';

test('fillTemplate escapes values and blanks unknown keys', () => {
  assert.equal(
    fillTemplate('<h1>{{ name }}</h1><p>{{batch}}{{nope}}</p>', {
      name: '<b>A & "B"</b>',
      batch: '24',
    }),
    '<h1>&lt;b&gt;A &amp; &quot;B&quot;&lt;/b&gt;</h1><p>24</p>',
  );
});

test('parseCsv reads quotes, embedded commas, newlines and CRLF', () => {
  assert.deepEqual(parseCsv('email,name\r\na@x.com,"Doe, ""J"""\n\nb@x.com,"two\nlines"\n'), [
    ['email', 'name'],
    ['a@x.com', 'Doe, "J"'],
    ['b@x.com', 'two\nlines'],
  ]);
});

test('csvCell quotes and defuses formulas', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(parseCsv(['x', csvCell('say "hi", ok')].join(','))[0]![1], 'say "hi", ok');
});
