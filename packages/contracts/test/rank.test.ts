import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RANKS, UNRATED_RANK, previousRankTitle, rankFor, ratingRankFor } from '../src/rank.ts';

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

test('rankFor maps solved thresholds to Codeforces tiers and Unrated fallback', () => {
  assert.equal(rankFor(0).title, 'Newbie');
  assert.equal(rankFor(399).title, 'Newbie');
  assert.equal(rankFor(400).title, 'Pupil');
  assert.equal(rankFor(799).title, 'Pupil');
  assert.equal(rankFor(800).title, 'Specialist');
  assert.equal(rankFor(1199).title, 'Specialist');
  assert.equal(rankFor(1200).title, 'Expert');
  assert.equal(rankFor(1599).title, 'Expert');
  assert.equal(rankFor(1600).title, 'Candidate Master');
  assert.equal(rankFor(1999).title, 'Candidate Master');
  assert.equal(rankFor(2000).title, 'Master');
  assert.equal(rankFor(2399).title, 'Master');
  assert.equal(rankFor(2400).title, 'Grandmaster');
  assert.equal(rankFor(2799).title, 'Grandmaster');
  assert.equal(rankFor(2800).title, 'Legendary GM');
  assert.equal(rankFor(4500).title, 'Legendary GM');

  // Unrated fallback: null/undefined or 0 solved with no CF handle
  assert.equal(rankFor(null).title, 'Unrated');
  assert.equal(rankFor(undefined).title, 'Unrated');
  assert.equal(rankFor(0, '').title, 'Unrated');
  assert.equal(rankFor(0, null).title, 'Unrated');
  assert.equal(rankFor(0, 'handle_ok').title, 'Newbie');
  assert.equal(UNRATED_RANK.color, '#B0B0B0');
});

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

test('ratingRankFor maps Codeforces ratings to official rank tiers and previousRankTitle resolves predecessors', () => {
  assert.equal(ratingRankFor(null).title, 'Unrated');
  assert.equal(ratingRankFor(0).title, 'Unrated');
  assert.equal(ratingRankFor(1199).title, 'Newbie');
  assert.equal(ratingRankFor(1200).title, 'Pupil');
  assert.equal(ratingRankFor(1399).title, 'Pupil');
  assert.equal(ratingRankFor(1400).title, 'Specialist');
  assert.equal(ratingRankFor(1600).title, 'Expert');
  assert.equal(ratingRankFor(1900).title, 'Candidate Master');
  assert.equal(ratingRankFor(2100).title, 'Master');
  assert.equal(ratingRankFor(2400).title, 'Grandmaster');
  assert.equal(ratingRankFor(3000).title, 'Legendary GM');

  assert.equal(previousRankTitle('Newbie'), null);
  assert.equal(previousRankTitle('Pupil'), 'Newbie');
  assert.equal(previousRankTitle('Expert'), 'Specialist');
  assert.equal(previousRankTitle('Candidate Master'), 'Expert');
});
