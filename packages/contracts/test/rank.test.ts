import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RANKS, previousRankTitle, rankFor } from '../src/rank.ts';

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLum([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(c1: [number, number, number], c2: [number, number, number]) {
  const l1 = relLum(c1),
    l2 = relLum(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('all rank tier text colors pass >= 4.5:1 WCAG AA contrast against #F6F4EE and pill background', () => {
  const paper = hexToRgb('#F6F4EE');
  for (const r of RANKS) {
    const fg = hexToRgb(r.textColor);
    const tier = hexToRgb(r.color);
    const pillBg: [number, number, number] =
      r.title === 'Legendary GM'
        ? tier
        : [
            Math.round(tier[0] * 0.12 + paper[0] * 0.88),
            Math.round(tier[1] * 0.12 + paper[1] * 0.88),
            Math.round(tier[2] * 0.12 + paper[2] * 0.88),
          ];
    assert.ok(
      contrast(fg, paper) >= 4.5,
      `${r.title} text (${r.textColor}) failed contrast against #F6F4EE`,
    );
    assert.ok(
      contrast(fg, pillBg) >= 4.5,
      `${r.title} text (${r.textColor}) failed contrast against pill bg`,
    );
  }
});

test('rankFor maps Codeforces ratings to official rank tiers and previousRankTitle resolves predecessors', () => {
  assert.equal(rankFor(null).title, 'Unrated');
  assert.equal(rankFor(0).title, 'Unrated');
  assert.equal(rankFor(1199).title, 'Newbie');
  assert.equal(rankFor(1200).title, 'Pupil');
  assert.equal(rankFor(1399).title, 'Pupil');
  assert.equal(rankFor(1400).title, 'Specialist');
  assert.equal(rankFor(1600).title, 'Expert');
  assert.equal(rankFor(1900).title, 'Candidate Master');
  assert.equal(rankFor(2100).title, 'Master');
  assert.equal(rankFor(2400).title, 'Grandmaster');
  assert.equal(rankFor(1899).title, 'Expert');
  assert.equal(rankFor(1934).title, 'Candidate Master');
  assert.equal(rankFor(3000).title, 'Legendary GM');

  assert.equal(previousRankTitle('Newbie'), null);
  assert.equal(previousRankTitle('Pupil'), 'Newbie');
  assert.equal(previousRankTitle('Expert'), 'Specialist');
  assert.equal(previousRankTitle('Candidate Master'), 'Expert');
});
