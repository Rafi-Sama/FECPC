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
 * Codeforces rank tiers by rating (`coalesce(cf_rating, rating)`), so a title always matches the number beside it.
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
    max: 1199,
  },
  {
    title: 'Pupil',
    color: '#008000',
    bg: 'rgba(0, 128, 0, 0.12)',
    textColor: '#006B00',
    border: 'rgba(0, 128, 0, 0.4)',
    hoverColor: '#006600',
    min: 1200,
    max: 1399,
  },
  {
    title: 'Specialist',
    color: '#03A89E',
    bg: 'rgba(3, 168, 158, 0.12)',
    textColor: '#006D67',
    border: 'rgba(3, 168, 158, 0.4)',
    hoverColor: '#028A82',
    min: 1400,
    max: 1599,
  },
  {
    title: 'Expert',
    color: '#0000FF',
    bg: 'rgba(0, 0, 255, 0.12)',
    textColor: '#0000DD',
    border: 'rgba(0, 0, 255, 0.4)',
    hoverColor: '#0000D6',
    min: 1600,
    max: 1899,
  },
  {
    title: 'Candidate Master',
    color: '#AA00AA',
    bg: 'rgba(170, 0, 170, 0.12)',
    textColor: '#8F008F',
    border: 'rgba(170, 0, 170, 0.4)',
    hoverColor: '#8E008E',
    min: 1900,
    max: 2099,
  },
  {
    title: 'Master',
    color: '#FF8C00',
    bg: 'rgba(255, 140, 0, 0.12)',
    textColor: '#9E5200',
    border: 'rgba(255, 140, 0, 0.4)',
    hoverColor: '#D97700',
    min: 2100,
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
    max: 2999,
  },
  {
    title: 'Legendary GM',
    color: '#FF0000',
    bg: '#FF0000',
    textColor: '#0B0B0B',
    border: '#FF0000',
    hoverColor: '#D60000',
    min: 3000,
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

export const RANK_TITLES: readonly string[] = [...RANKS.map((r) => r.title), UNRATED_RANK.title];

/** The Codeforces rank for a rating; no rating (null or <= 0) is Unrated. */
export function rankFor(rating: number | null | undefined): Rank {
  if (!rating || !(rating > 0)) return UNRATED_RANK;
  return RANKS.find((r) => rating >= r.min && rating <= r.max) ?? RANKS[RANKS.length - 1]!;
}

/** Returns the rank title immediately below `title` in `RANKS`, or null if lowest/unknown. */
export function previousRankTitle(title: string): string | null {
  const idx = RANKS.findIndex((r) => r.title === title);
  return idx > 0 ? RANKS[idx - 1]!.title : null;
}
