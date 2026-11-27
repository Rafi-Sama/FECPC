import type { FeedCategory } from '@fecpc/contracts';

export const cmMeta = 'font-label text-[12px] uppercase [color:var(--dim)]'; // was .cm-meta

export const FEED_CATEGORIES: { value: FeedCategory; label: string; chip: string }[] = [
  { value: 'problem-solving', label: 'Wins · Problem-solving', chip: 'Wins' },
  { value: 'upsolving', label: 'Help · Upsolving', chip: 'Help' },
  { value: 'topic', label: 'Contests · Topic', chip: 'Contests' },
];

export function feedCategoryChip(cat: FeedCategory): string {
  return FEED_CATEGORIES.find((c) => c.value === cat)?.chip ?? cat;
}
