export type Rank = {
  title: string;
  color: string;
  bg: string;
  textColor: string;
  border: string;
  hoverColor: string;
  min: number;
  max: number;
  unrated?: boolean;
};

/**
 * Codeforces-inspired rank tier map derived from `users.problems_solved`.
 *
 * - `color` is the canonical tier hex used for the 4px left accent bar, avatar ring,
 *   and translucent pill background/border.
 * - `textColor` is audited to reach >= 4.5:1 WCAG AA contrast against both `#F6F4EE`
 *   (panel paper) and the 12% tier-tinted pill background.
 * - `hoverColor` darkens `color` ~15% for the card left accent bar hover state.
 */
export const RANKS: Rank[] = [
  {
    title: 'Newbie',
    color: '#808080',
    bg: 'rgba(128, 128, 128, 0.12)',
    textColor: '#595959',
    border: 'rgba(128, 128, 128, 0.4)',
    hoverColor: '#6B6B6B',
    min: 0,
    max: 399,
  },
  {
    title: 'Pupil',
    color: '#008000',
    bg: 'rgba(0, 128, 0, 0.12)',
    textColor: '#006B00',
    border: 'rgba(0, 128, 0, 0.4)',
    hoverColor: '#006600',
    min: 400,
    max: 799,
  },
  {
    title: 'Specialist',
    color: '#03A89E',
    bg: 'rgba(3, 168, 158, 0.12)',
    textColor: '#006D67',
    border: 'rgba(3, 168, 158, 0.4)',
    hoverColor: '#028A82',
    min: 800,
    max: 1199,
  },
  {
    title: 'Expert',
    color: '#0000FF',
    bg: 'rgba(0, 0, 255, 0.12)',
    textColor: '#0000DD',
    border: 'rgba(0, 0, 255, 0.4)',
    hoverColor: '#0000D6',
    min: 1200,
    max: 1599,
  },
  {
    title: 'Candidate Master',
    color: '#AA00AA',
    bg: 'rgba(170, 0, 170, 0.12)',
    textColor: '#8F008F',
    border: 'rgba(170, 0, 170, 0.4)',
    hoverColor: '#8E008E',
    min: 1600,
    max: 1999,
  },
  {
    title: 'Master',
    color: '#FF8C00',
    bg: 'rgba(255, 140, 0, 0.12)',
    textColor: '#9E5200',
    border: 'rgba(255, 140, 0, 0.4)',
    hoverColor: '#D97700',
    min: 2000,
    max: 2399,
  },
  {
    title: 'Grandmaster',
    color: '#FF0000',
    bg: 'rgba(255, 0, 0, 0.12)',
    textColor: '#C40000',
    border: 'rgba(255, 0, 0, 0.4)',
    hoverColor: '#D60000',
    min: 2400,
    max: 2799,
  },
  {
    title: 'Legendary GM',
    color: '#FF0000',
    bg: '#FF0000',
    textColor: '#0B0B0B',
    border: '#FF0000',
    hoverColor: '#D60000',
    min: 2800,
    max: Number.POSITIVE_INFINITY,
  },
];

export const UNRATED_RANK: Rank = {
  title: 'Unrated',
  color: '#B0B0B0',
  bg: 'transparent',
  textColor: '#595959',
  border: 'rgba(176, 176, 176, 0.4)',
  hoverColor: '#949494',
  min: -1,
  max: -1,
  unrated: true,
};

/**
 * Returns the rank tier for a member's `problems_solved` count.
 * When `solved` is null/undefined, or `solved <= 0` and `cfHandle` is explicitly
 * empty/missing, returns the `Unrated` fallback tier.
 */
export function rankFor(solved: number | null | undefined, cfHandle?: string | null): Rank {
  if (solved === null || solved === undefined || Number.isNaN(solved)) {
    return UNRATED_RANK;
  }
  const n = Math.max(0, Math.floor(solved));
  if (n === 0 && cfHandle !== undefined && !cfHandle?.trim()) {
    return UNRATED_RANK;
  }
  for (const r of RANKS) {
    if (n >= r.min && n <= r.max) return r;
  }
  return RANKS[RANKS.length - 1]!;
}

export const RANK_TITLES: readonly string[] = [...RANKS.map((r) => r.title), UNRATED_RANK.title];

/**
 * Maps a Codeforces numeric rating to its official rank tier (using the same
 * visual Rank objects from `RANKS`).
 * - <= 0 / null / undefined → Unrated
 * - 1..1199 → Newbie
 * - 1200..1399 → Pupil
 * - 1400..1599 → Specialist
 * - 1600..1899 → Expert
 * - 1900..2099 → Candidate Master
 * - 2100..2399 → Master
 * - 2400..2999 → Grandmaster
 * - 3000+ → Legendary GM
 */
export function ratingRankFor(rating: number | null | undefined): Rank {
  if (rating === null || rating === undefined || Number.isNaN(rating) || rating <= 0) {
    return UNRATED_RANK;
  }
  const r = Math.floor(rating);
  if (r < 1200) return RANKS[0]!; // Newbie
  if (r < 1400) return RANKS[1]!; // Pupil
  if (r < 1600) return RANKS[2]!; // Specialist
  if (r < 1900) return RANKS[3]!; // Expert
  if (r < 2100) return RANKS[4]!; // Candidate Master
  if (r < 2400) return RANKS[5]!; // Master
  if (r < 3000) return RANKS[6]!; // Grandmaster
  return RANKS[7]!; // Legendary GM
}

/** Returns the rank title immediately below `title` in `RANKS`, or null if lowest/unknown. */
export function previousRankTitle(title: string): string | null {
  const idx = RANKS.findIndex((r) => r.title === title);
  return idx > 0 ? RANKS[idx - 1]!.title : null;
}
