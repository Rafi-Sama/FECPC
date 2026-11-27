import type { IdeaType } from '@fecpc/contracts';

export const ideaSubmitFoot =
  'cm-idea-submit-foot flex items-center justify-between flex-wrap gap-3 pt-4 [border-top:2px_solid_var(--line2)]';

export const cmChips = 'flex-wrap'; // was .cm-chips
export const cmIdeaMeta = 'flex-wrap font-label text-[12px] [color:var(--dim)]'; // was .cm-idea-meta
export const cmIdeaTags = 'flex-wrap'; // was .cm-idea-tags
export const cmIdeaTag =
  'py-px px-1.5 [background:var(--bg)] text-ink text-[11px] leading-[1.5] uppercase whitespace-nowrap [&.status-open]:text-acc [&.status-planned]:text-acc2 [&.status-shipped]:[color:var(--mut)] [&&.status-closed]:text-bad'; // was .cm-idea-tag
export const cmIdeaAcceptedBadge =
  'py-0.5 px-[7px] font-label text-[10px] font-bold leading-[1.4] whitespace-nowrap'; // was .cm-idea-accepted-badge
export const cmIdeaInterestedLabel = '[color:var(--dim)] font-label text-[12px] uppercase'; // was .cm-idea-interested-label
export const cmIdeaStatusBadge =
  'py-0.5 px-[7px] font-label text-[10px] font-bold leading-[1.4] whitespace-nowrap'; // was .cm-idea-status-badge
export const cmSideBox = 'flex-col [background:var(--bg)]'; // was .cm-side-box
export const cmIdeaSubmitTitle = 'm-0'; // was .cm-idea-submit-title
export const cmIdeaSubmitNote = '[color:var(--dim)] font-label text-[11px] uppercase'; // was .cm-idea-submit-note
export const cmIdeaPublish = 'text-bg hover:border-acc hover:text-on'; // was .cm-idea-publish

export const IDEA_TYPE_OPTIONS: { value: IdeaType; label: string; short: string }[] = [
  { value: 'idea', label: 'Idea', short: 'Idea' },
  { value: 'teammate', label: 'Teammate Request', short: 'Teammate' },
  { value: 'study', label: 'Study Partner', short: 'Study' },
];

export function ideaTypeLabel(type: IdeaType): string {
  return IDEA_TYPE_OPTIONS.find((t) => t.value === type)?.short ?? type;
}
