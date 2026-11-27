'use client';
import Image from 'next/image';
import { useEffect, useRef, type RefObject } from 'react';
import type { AlumniJob } from '@fecpc/contracts';
import { deterministicColor, formatDeadlineStatus } from './JobCard';
import { useStore } from '@/components/app/Store';
import { canFully } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const sectionHead =
  'm pb-2 mb-3.5 block [border-bottom:1px_solid_var(--line)] text-ink [font:700_11px_ui-monospace,_Menlo,_monospace]';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapModalFocus(event: KeyboardEvent, modal: HTMLDivElement) {
  if (event.key !== 'Tab') return;

  const nodes = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.offsetParent !== null,
  );
  const first = nodes[0];
  const last = nodes.at(-1);
  if (!first || !last) return;

  const active = document.activeElement;
  const outside = !active || !modal.contains(active);
  const shouldWrapBackward = event.shiftKey && (active === first || outside);
  const shouldWrapForward = !event.shiftKey && (active === last || outside);

  if (shouldWrapBackward) {
    event.preventDefault();
    last.focus();
  } else if (shouldWrapForward) {
    event.preventDefault();
    first.focus();
  }
}

function useJobModalBehavior(
  modalRef: RefObject<HTMLDivElement | null>,
  closeBtnRef: RefObject<HTMLButtonElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (modalRef.current) trapModalFocus(event, modalRef.current);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeBtnRef, modalRef, onClose]);
}

async function deleteJob(
  job: AlumniJob,
  onDeleted: ((jobId: number) => Promise<void> | void) | undefined,
  onClose: () => void,
  sure: (question: string) => Promise<boolean>,
  toast: (text: string, kind?: 'bad') => void,
) {
  if (!(await sure(`Delete job posting for "${job.title || job.role}" at ${job.company}?`))) {
    return;
  }

  try {
    const res = await fetch('/api/alumni', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'deleteAlumniJob', jobId: job.id }),
    });
    if (res.ok) {
      await onDeleted?.(job.id);
      onClose();
    } else {
      toast('Could not delete the job posting.', 'bad');
    }
  } catch {
    toast('Could not reach the server. Try again.', 'bad');
  }
}

function getHeroBackground(source: AlumniJob['source'], isClosed: boolean) {
  if (isClosed) return '#8A877D';
  return source === 'fetched' ? '#0B0B0B' : '#1F3BFF';
}

function getSourceClass(source: AlumniJob['source'], isClosed: boolean) {
  const sourceClass = source === 'fetched' ? 'fetched' : 'manual';
  return `${sourceClass}${isClosed ? ' closed' : ''}`;
}

function getSourceLabel(source: AlumniJob['source']) {
  return source === 'fetched' ? 'Public board · Job' : 'Alumni · Job';
}

function getSourceFooter(source: AlumniJob['source']) {
  return source === 'manual' ? 'Posted manually by an alumnus' : 'Fetched from a public board';
}

function CompanyLogo({
  job,
  companyColor,
  companyInitial,
}: Readonly<{ job: AlumniJob; companyColor: string; companyInitial: string }>) {
  if (job.company_logo_url) {
    return (
      <Image
        src={job.company_logo_url}
        alt={job.company}
        width={76}
        height={76}
        unoptimized
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    );
  }

  return (
    <b
      className="[font:700_32px_Inter,_Arial,_sans-serif] tracking-[-1px]"
      style={{ color: companyColor }}
    >
      {companyInitial}
    </b>
  );
}

function FactsPanel({ facts }: Readonly<{ facts: [string, string][] }>) {
  if (facts.length === 0) return null;

  return (
    <div className="t-d:[&>div]:[border-left-color:var(--line,#2a2927)] mb-7 [display:grid] grid-cols-[repeat(auto-fit,_minmax(130px,_1fr))] [border:2px_solid_var(--line2)] [background:var(--bg)]">
      {facts.map(([label, value]) => (
        <FactCell key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function FactCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="py-3 px-3.5">
      <span className="m [font:11px_ui-monospace,_Menlo,_monospace] text-dim">{label}</span>
      <span className="mt-1 block text-[14px] font-semibold text-ink">{value}</span>
    </div>
  );
}

// NOSONAR - the modal keeps its responsive layout and accessibility behavior in one component.
export function JobDetailModal({
  job,
  onClose,
  onDeleted,
}: Readonly<{
  job: AlumniJob;
  onClose: () => void;
  onDeleted?: (jobId: number) => Promise<void> | void;
}>) {
  const sure = useConfirm();
  const { toast } = useStore();
  const { me, s } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const isOwner = job.mine || (job.alumni_id && job.alumni_id === me.id);
  const canDelete = isOwner || canFully(s.roles, 'alumni.job.fetch');

  const { text: deadlineText, isClosed } = formatDeadlineStatus(job.deadline);
  const companyColor = deterministicColor(job.company);
  const companyInitial = (job.company || 'C').trim().charAt(0).toUpperCase();
  const vacancies = Math.max(1, Number(job.vacancies || 1));
  const ghostVacNumber = String(vacancies).padStart(2, '0');

  const heroBg = getHeroBackground(job.source, isClosed);

  useJobModalBehavior(modalRef, closeBtnRef, onClose);

  const responsibilities = Array.isArray(job.responsibilities) ? job.responsibilities : [];
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];
  const canApply = Boolean(job.url) && !isClosed;

  const deadlineDate = job.deadline
    ? new Date(job.deadline).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Open until filled';
  const facts = [
    ['Location', job.location],
    ['Job type', job.job_type],
    ['Experience', job.experience],
    ['Salary', job.salary],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));
  const originalPostNote = canApply ? ' · opens original post' : '';
  const applicationNote = isClosed ? 'Applications closed' : deadlineText + originalPostNote;

  return (
    <dialog
      open
      className="ov open inset-0 py-[4vh] px-5 m-0 fixed w-[100vw] h-[100vh] box-border [border:0] max-w-[none] max-h-[none] [background:rgba(11,_11,_11,_0.62)] flex [align-items:safe_center] justify-center overflow-y-auto z-[9999] [backdrop-filter:blur(2px)]"
      aria-label={`${job.title || job.role} at ${job.company}`}
    >
      <button
        type="button"
        aria-label="Close modal"
        tabIndex={-1}
        onClick={onClose}
        className="inset-0 p-0 absolute w-full h-full [border:0] [background:transparent] cursor-default"
      />
      <div
        ref={modalRef}
        className="md job-detail-modal max-[861px]:max-h-[100vh]! max-[861px]:[border-width:0]! max-[861px]:[box-shadow:none]! max-[861px]:overflow-y-auto! my-0 mx-auto w-full max-w-[1040px] [background:var(--panel)] [border:2px_solid_var(--line2)] [box-shadow:10px_10px_0_var(--line2)] relative [animation:rise_0.2s_ease-out] overflow-hidden z-[1]"
      >
        {/* Close Button matching Alumni-Jobs.html */}
        <button
          ref={closeBtnRef}
          type="button"
          className="x top-3 right-3 p-0 absolute w-[40px] h-[40px] min-h-0 text-[22px] leading-[1] [background:var(--panel)] [border:2px_solid_var(--line2)] text-ink z-[10] cursor-pointer flex items-center justify-center font-bold"
          aria-label="Close modal"
          onClick={onClose}
        >
          ×
        </button>

        {/* 2-Column Structure (.cols) */}
        <div className="cols flex flex-wrap">
          {/* Left Column (.lc) */}
          <div
            className={`lc ${getSourceClass(job.source, isClosed)} flex-[0_0_320px] min-w-0 [border-right:1px_solid_var(--line)] flex flex-col [background:var(--panel)]`}
          >
            {/* Hero Band (96px) */}
            <div
              className="job-detail-modal__hero relative h-[96px] overflow-hidden"
              style={{ background: heroBg }}
            >
              <span className="m top-4.5 left-7 absolute text-on [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase z-[1]">
                {getSourceLabel(job.source)}
              </span>

              <span
                className="big -top-4 right-3 absolute [font:700_130px/1_Inter,_Arial,_sans-serif] tracking-[-6px] [color:transparent] [user-select:none] pointer-events-none"
                aria-hidden="true"
                style={{ WebkitTextStroke: '1.5px rgba(255,255,255,.4)' }}
              >
                {ghostVacNumber}
              </span>
            </div>

            {/* Inner Padding 28px (.in28) */}
            <div className="in28 job-detail-modal__summary pt-0 px-7 pb-7 flex flex-col flex-1">
              {/* Overlapping Logo */}
              <div className="logo p-1 -mt-11 inline-block [background:var(--panel)] leading-[0] self-start relative z-[2]">
                <div
                  className="in w-[76px] h-[76px] [background:var(--bg)] flex items-center justify-center overflow-hidden"
                  style={{ border: `2px solid ${companyColor}` }}
                >
                  <CompanyLogo
                    job={job}
                    companyColor={companyColor}
                    companyInitial={companyInitial}
                  />
                </div>
              </div>

              {/* Title & Company */}
              <h2 className="mt-4 mx-0 mb-1.5 text-[25px] leading-[1.15] tracking-[-.5px] font-bold text-ink">
                {job.title || job.role}
              </h2>
              <div className="co mb-5.5 [font:14px_ui-monospace,_Menlo,_Consolas,_monospace] text-mut">
                {job.company}
              </div>

              {/* Compact summary matching the reference modal */}
              <div className="sb mb-4 flex [border:2px_solid_var(--line2)] [background:var(--bg)]">
                <div className="py-3 px-3.5 flex-1 [border-left:0]">
                  <span className="m block [font:11px_ui-monospace,_Menlo,_monospace] text-dim">
                    Vacancies
                  </span>
                  <b className="mt-1 block text-[26px] tracking-[-1px] leading-[1.1] text-ink">
                    {vacancies}
                  </b>
                </div>
                <div className="py-3 px-3.5 flex-1 [border-left:1px_solid_var(--line)]">
                  <span className="m block [font:11px_ui-monospace,_Menlo,_monospace] text-dim">
                    Apply by
                  </span>
                  <b className="pt-1.5 block text-[16px] tracking-[0] leading-[1.1] text-ink">
                    {deadlineDate}
                  </b>
                </div>
              </div>

              {/* Apply Button / CTA Row */}
              <div className="apply mt-auto flex flex-col gap-2.5">
                {canApply ? (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn b w-full min-h-[52px] text-[14px] [background:var(--acc)] text-on flex items-center justify-center font-semibold [text-decoration:none] [border:2px_solid_var(--line2)]"
                  >
                    Apply now ↗
                  </a>
                ) : (
                  <span className="btn w-full min-h-[52px] text-dim" aria-disabled="true">
                    {isClosed ? 'Applications closed' : 'No link provided'}
                  </span>
                )}

                <span
                  className="m note text-center [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase"
                  style={{ color: isClosed ? 'var(--bad, #C4321C)' : 'var(--dim, #5F5F5F)' }}
                >
                  {applicationNote}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column (.rc) */}
          <div className="flex flex-col gap-5 pt-9 px-9 pb-8 flex-[1_1_440px] min-w-0 [background:var(--panel)]">
            {/* Facts Grid matching Alumni-Jobs.html */}
            <FactsPanel facts={facts} />

            {/* About the role */}
            {job.description && (
              <div className="sc mb-7">
                <span className={sectionHead}>About the role</span>
                <p className="t m-0 text-[14px] leading-[1.6] text-mut">{job.description}</p>
              </div>
            )}

            {/* Responsibilities */}
            {responsibilities.length > 0 && (
              <div className="sc mb-7">
                <span className={sectionHead}>Responsibilities</span>
                <ul className="p-0 m-0 [list-style:none]">
                  {responsibilities.map((resp) => (
                    <li
                      key={resp}
                      className="py-[7px] pr-0 pl-5.5 relative text-[14px] leading-[1.55] text-mut"
                    >
                      <span
                        aria-hidden="true"
                        className="top-[15px] left-0 absolute w-[8px] h-[8px] [background:var(--acc)]"
                      />
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requirements */}
            {requirements.length > 0 && (
              <div className="sc mb-7">
                <span className={sectionHead}>Requirements</span>
                <ul className="p-0 m-0 [list-style:none]">
                  {requirements.map((req) => (
                    <li
                      key={req}
                      className="py-[7px] pr-0 pl-5.5 relative text-[14px] leading-[1.55] text-mut"
                    >
                      <span
                        aria-hidden="true"
                        className="top-[15px] left-0 absolute w-[8px] h-[8px] [background:var(--acc)]"
                      />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="hidden max-[861px]:flex py-3 px-4 [background:var(--panel)] [border-top:2px_solid_var(--line2)]">
          {canApply ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn b w-full min-h-[50px] [text-decoration:none]"
            >
              Apply now ↗
            </a>
          ) : (
            <span className="btn w-full min-h-[50px]" aria-disabled="true">
              {isClosed ? 'Applications closed' : 'No link provided'}
            </span>
          )}
        </div>

        <div className="py-3.5 px-5 flex justify-between items-center gap-3 flex-wrap [border-top:2px_solid_var(--line2)] [background:var(--bg)] t-d:[border-color:var(--line2,#55524c)]">
          <span className="m">{getSourceFooter(job.source)}</span>
          {canDelete && (
            <button
              type="button"
              onClick={() => void deleteJob(job, onDeleted, onClose, sure, toast)}
              className="btn sm danger"
            >
              Delete job
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

export default JobDetailModal;
