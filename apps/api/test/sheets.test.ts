// Sheet parsing and the weekly pick: pure functions, no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLinks, pickWeekly, type CfProblem } from '../src/modules/member-area/sheets.ts';

test('parseLinks: problemset and contest links, deduped, gym refused', () => {
  assert.deepEqual(
    parseLinks(
      'https://codeforces.com/problemset/problem/1352/C\ncodeforces.com/contest/1772/problem/f1 x https://codeforces.com/contest/1352/problem/C',
    ),
    ['1352C', '1772F1'],
  );
  assert.deepEqual(parseLinks('1352C and https://example.com'), []);
  assert.throws(() => parseLinks('https://codeforces.com/gym/104/problem/A'));
});

test('pickWeekly: one per band slot, recent, unused, deterministic', () => {
  const problems: CfProblem[] = [];
  for (let c = 1000; c < 2000; c++)
    for (const [i, r] of [800, 1200, 1500, 1800, 2100].entries())
      problems.push({
        contestId: c,
        index: 'ABCDE'[i]!,
        name: `${c}`,
        rating: r,
        tags: [`t${c % 7}`],
      });
  const stats = problems.map((p) => ({ ...p, solvedCount: p.contestId! }));
  const a = pickWeekly(problems, stats, new Set(['1999A']), 7);
  assert.equal(a.length, 12);
  assert.deepEqual(a, pickWeekly(problems, stats, new Set(['1999A']), 7));
  assert.notDeepEqual(a, pickWeekly(problems, stats, new Set(['1999A']), 8));
  assert.ok(a.every((p) => !p.id.startsWith('1999A') && +p.id.slice(0, 4) > 1999 - 700));
  assert.deepEqual(
    a.map((p) => p.rating),
    [800, 800, 800, 1200, 1200, 1200, 1500, 1500, 1500, 1800, 1800, 2100],
  );
});
