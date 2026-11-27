'use client';
import React from 'react';
import type { AlumniJob } from '@fecpc/contracts';
import { HighlightMatch } from './HighlightMatch';

const LOGO_PALETTE = [
  '#1F3BFF', // cobalt
  '#AA00AA', // purple
  '#03A89E', // teal
  '#0B0B0B', // ink
  '#E5560B', // orange
  '#2A7D2E', // forest
];

export function deterministicColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  const idx = Math.abs(h) % LOGO_PALETTE.length;
  return LOGO_PALETTE[idx];
}

export function formatDeadlineStatus(deadlineStr?: string | null): {
  text: string;
  isClosed: boolean;
  isSoon: boolean;
} {
  if (!deadlineStr) {
    return { text: 'Open role', isClosed: false, isSoon: false };
  }

  const d = new Date(deadlineStr);
  if (Number.isNaN(d.getTime())) {
    return { text: `Apply by ${deadlineStr}`, isClosed: false, isSoon: false };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Closed', isClosed: true, isSoon: false };
  }
  if (diffDays === 0) {
    return { text: 'Closes today', isClosed: false, isSoon: true };
  }
  if (diffDays === 1) {
    return { text: '1 day left', isClosed: false, isSoon: true };
  }
  if (diffDays <= 5) {
    return { text: `${diffDays} days left`, isClosed: false, isSoon: true };
  }

  const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { text: `Apply by ${formatted}`, isClosed: false, isSoon: false };
}

export function JobCard({
  job,
  onOpenDetail,
  highlightQuery,
}: {
  readonly job: AlumniJob;
  readonly onOpenDetail: (job: AlumniJob) => void;
  readonly highlightQuery?: string;
}) {
  const { text: statusText, isClosed, isSoon } = formatDeadlineStatus(job.deadline);
  const companyColor = deterministicColor(job.company);
  const companyInitial = (job.company || 'C').trim().charAt(0).toUpperCase();
  const vacancies = Math.max(1, Number(job.vacancies || 1));
  const ghostVacNumber = String(vacancies).padStart(2, '0');

  let bandBg = 'var(--acc, #1F3BFF)'; // manual default
  if (isClosed) {
    bandBg = '#8A877D'; // muted grey
  } else if (job.source === 'fetched') {
    bandBg = 'var(--line2, #0B0B0B)'; // public board ink
  }

  const statusDotColor = isClosed ? '#8A877D' : isSoon ? '#E5560B' : 'var(--acc, #1F3BFF)';

  return (
    <article
      className={`job ${job.source === 'fetched' ? 'fetched' : 'manual'} ${isClosed ? 'closed' : ''} ${isSoon ? 'soon' : ''} relative [background:var(--panel)] [border:2px_solid_var(--line2)] overflow-hidden flex flex-col cursor-pointer [transition:transform_0.14s_ease,_box-shadow_0.14s_ease]`}
      tabIndex={0}
      role="button"
      aria-label={`${job.title || job.role} at ${job.company}, ${job.location || 'Remote'}. ${statusText}. View details.`}
      onClick={() => onOpenDetail(job)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(job);
        }
      }}
    >
      {/* 76px Header Band matching Alumni-Jobs.html */}
      <div
        className="band relative h-[76px] overflow-hidden flex-none"
        style={{ background: bandBg }}
      >
        {/* Source label at top-left */}
        <span className="m top-4 left-5 absolute text-on [font:11px_ui-monospace,_Menlo,_Consolas,_monospace] tracking-[.06em] uppercase z-[1]">
          {job.source === 'fetched' ? 'Public board · Job' : 'Alumni · Job'}
        </span>

        {/* Ghost vacancy number at top-right */}
        <span
          className="big -top-3.5 right-3.5 absolute [font:700_112px/1_Inter,_Arial,_sans-serif] tracking-[-5px] [color:transparent] [user-select:none] pointer-events-none"
          aria-hidden="true"
          style={{ WebkitTextStroke: '1.5px rgba(255,255,255,.42)' }}
        >
          {ghostVacNumber}
        </span>
      </div>

      {/* Body with overlapping logo and vacancy badge */}
      <div className="body pt-0 px-5 pb-4.5 flex flex-col flex-1">
        <div className="top flex justify-between items-end gap-2">
          {/* Overlapping logo */}
          <div className="logo p-1 -mt-8.5 inline-block [background:var(--panel)] leading-[0] self-start relative z-[2]">
            <div
              className="in w-[60px] h-[60px] [background:var(--bg)] flex items-center justify-center overflow-hidden"
              style={{ border: `2px solid ${companyColor}` }}
            >
              {job.company_logo_url ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={job.company_logo_url}
                  alt={`${job.company} logo`}
                  className="w-full h-full object-contain block"
                />
              ) : (
                <b
                  className="[font:700_24px_Inter,_Arial,_sans-serif] tracking-[-1px]"
                  style={{ color: companyColor }}
                >
                  {companyInitial}
                </b>
              )}
            </div>
          </div>

          {/* Vacancy badge */}
          <span className="vac py-[5px] px-[9px] mb-0.5 [font:600_11px_ui-monospace,_Menlo,_Consolas,_monospace] tracking-[.06em] uppercase [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink inline-flex items-center gap-[7px]">
            <i
              className="w-[8px] h-[8px] inline-block"
              style={{ background: isClosed ? '#8A877D' : 'var(--acc, #1F3BFF)' }}
            />
            {vacancies} {vacancies === 1 ? 'vacancy' : 'vacancies'}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-3 mx-0 mb-1 text-[19px] leading-[1.25] font-semibold tracking-[-.2px]">
          <span className="text-ink [text-decoration:none]">
            <HighlightMatch text={job.title || job.role} query={highlightQuery} />
          </span>
        </h3>

        {/* Company in mono */}
        <div className="co mb-4.5 [font:13px_ui-monospace,_Menlo,_Consolas,_monospace] tracking-[.02em] text-mut">
          <HighlightMatch text={job.company} query={highlightQuery} />
        </div>

        {/* Foot with status dot and View details affordance */}
        <div className="foot pt-3.5 mt-auto flex justify-between items-center [border-top:1px_solid_var(--line)] gap-2">
          <span className="m text-ink flex items-center gap-2 [font:11px_ui-monospace,_Menlo,_Consolas,_monospace] tracking-[.06em] uppercase">
            <i className="w-[9px] h-[9px] inline-block" style={{ background: statusDotColor }} />
            {statusText}
          </span>

          <span className="m text-ink [font:11px_ui-monospace,_Menlo,_Consolas,_monospace] tracking-[.06em] uppercase">
            View details →
          </span>
        </div>
      </div>
    </article>
  );
}

export default JobCard;
