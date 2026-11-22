'use client';
import Image from 'next/image';
import { useEffect, useRef, type RefObject } from 'react';
import type { AlumniJob } from '@fecpc/contracts';
import { deterministicColor, formatDeadlineStatus } from './JobCard';
import { useStore } from '@/components/app/Store';
import { canFully } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

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
      style={{
        font: '700 32px Inter, Arial, sans-serif',
        letterSpacing: '-1px',
        color: companyColor,
      }}
    >
      {companyInitial}
    </b>
  );
}

function FactsPanel({ facts }: Readonly<{ facts: [string, string][] }>) {
  if (facts.length === 0) return null;

  return (
    <div
      className="facts"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        border: '2px solid var(--line2, #0B0B0B)',
        marginBottom: 28,
        background: 'var(--bg, #FFFFFF)',
      }}
    >
      {facts.map(([label, value]) => (
        <FactCell key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function FactCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div style={{ padding: '12px 14px' }}>
      <span
        className="m"
        style={{ font: '11px ui-monospace, Menlo, monospace', color: 'var(--dim, #5F5F5F)' }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 14,
          fontWeight: 600,
          marginTop: 4,
          color: 'var(--ink, #0B0B0B)',
        }}
      >
        {value}
      </span>
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
      className="ov open"
      aria-label={`${job.title || job.role} at ${job.company}`}
      style={{
        position: 'fixed',
        inset: 0,
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        boxSizing: 'border-box',
        margin: 0,
        border: 0,
        maxWidth: 'none',
        maxHeight: 'none',
        background: 'rgba(11, 11, 11, 0.62)',
        display: 'flex',
        alignItems: 'safe center',
        justifyContent: 'center',
        padding: '4vh 20px',
        overflowY: 'auto',
        zIndex: 9999,
        backdropFilter: 'blur(2px)',
      }}
    >
      <button
        type="button"
        aria-label="Close modal"
        tabIndex={-1}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          padding: 0,
          border: 0,
          background: 'transparent',
          cursor: 'default',
        }}
      />
      <div
        ref={modalRef}
        className="md job-detail-modal"
        style={{
          width: '100%',
          maxWidth: 1040,
          margin: '0 auto',
          background: 'var(--panel, #F6F4EE)',
          border: '2px solid var(--line2, #0B0B0B)',
          boxShadow: '10px 10px 0 var(--line2, #0B0B0B)',
          position: 'relative',
          animation: 'rise 0.2s ease-out',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Close Button matching Alumni-Jobs.html */}
        <button
          ref={closeBtnRef}
          type="button"
          className="x"
          aria-label="Close modal"
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            width: 40,
            height: 40,
            minHeight: 0,
            padding: 0,
            fontSize: 22,
            lineHeight: 1,
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
            color: 'var(--ink, #0B0B0B)',
            zIndex: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          ×
        </button>

        {/* 2-Column Structure (.cols) */}
        <div className="cols" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Left Column (.lc) */}
          <div
            className={`lc ${getSourceClass(job.source, isClosed)}`}
            style={{
              flex: '0 0 320px',
              borderRight: '1px solid var(--line, #CFCBBF)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--panel, #F6F4EE)',
            }}
          >
            {/* Hero Band (96px) */}
            <div
              className="job-detail-modal__hero"
              style={{
                position: 'relative',
                height: 96,
                background: heroBg,
                overflow: 'hidden',
              }}
            >
              <span
                className="m"
                style={{
                  position: 'absolute',
                  left: 28,
                  top: 18,
                  color: 'var(--on, #FFFFFF)',
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  zIndex: 1,
                }}
              >
                {getSourceLabel(job.source)}
              </span>

              <span
                className="big"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: -16,
                  font: '700 130px/1 Inter, Arial, sans-serif',
                  letterSpacing: '-6px',
                  color: 'transparent',
                  WebkitTextStroke: '1.5px rgba(255,255,255,.4)',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {ghostVacNumber}
              </span>
            </div>

            {/* Inner Padding 28px (.in28) */}
            <div
              className="in28 job-detail-modal__summary"
              style={{
                padding: '0 28px 28px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              {/* Overlapping Logo */}
              <div
                className="logo"
                style={{
                  display: 'inline-block',
                  marginTop: -44,
                  background: 'var(--panel, #F6F4EE)',
                  padding: 4,
                  lineHeight: 0,
                  alignSelf: 'flex-start',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <div
                  className="in"
                  style={{
                    width: 76,
                    height: 76,
                    border: `2px solid ${companyColor}`,
                    background: 'var(--bg, #FFFFFF)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <CompanyLogo
                    job={job}
                    companyColor={companyColor}
                    companyInitial={companyInitial}
                  />
                </div>
              </div>

              {/* Title & Company */}
              <h2
                style={{
                  fontSize: 25,
                  lineHeight: 1.15,
                  margin: '16px 0 6px',
                  letterSpacing: '-.5px',
                  fontWeight: 700,
                  color: 'var(--ink, #0B0B0B)',
                }}
              >
                {job.title || job.role}
              </h2>
              <div
                className="co"
                style={{
                  font: '14px ui-monospace, Menlo, Consolas, monospace',
                  marginBottom: 22,
                  color: 'var(--mut, #3B3A35)',
                }}
              >
                {job.company}
              </div>

              {/* Compact summary matching the reference modal */}
              <div
                className="sb"
                style={{
                  display: 'flex',
                  border: '2px solid var(--line2, #0B0B0B)',
                  marginBottom: 16,
                  background: 'var(--bg, #FFFFFF)',
                }}
              >
                <div style={{ flex: 1, padding: '12px 14px', borderLeft: 0 }}>
                  <span
                    className="m"
                    style={{
                      display: 'block',
                      font: '11px ui-monospace, Menlo, monospace',
                      color: 'var(--dim, #5F5F5F)',
                    }}
                  >
                    Vacancies
                  </span>
                  <b
                    style={{
                      display: 'block',
                      fontSize: 26,
                      letterSpacing: '-1px',
                      lineHeight: 1.1,
                      marginTop: 4,
                      color: 'var(--ink, #0B0B0B)',
                    }}
                  >
                    {vacancies}
                  </b>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderLeft: '1px solid var(--line, #CFCBBF)',
                  }}
                >
                  <span
                    className="m"
                    style={{
                      display: 'block',
                      font: '11px ui-monospace, Menlo, monospace',
                      color: 'var(--dim, #5F5F5F)',
                    }}
                  >
                    Apply by
                  </span>
                  <b
                    style={{
                      display: 'block',
                      fontSize: 16,
                      paddingTop: 6,
                      letterSpacing: 0,
                      lineHeight: 1.1,
                      color: 'var(--ink, #0B0B0B)',
                    }}
                  >
                    {deadlineDate}
                  </b>
                </div>
              </div>

              {/* Apply Button / CTA Row */}
              <div
                className="apply job-detail-modal__apply"
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {canApply ? (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn b"
                    style={{
                      width: '100%',
                      minHeight: 52,
                      fontSize: 14,
                      background: 'var(--acc, #1F3BFF)',
                      borderColor: 'var(--acc, #1F3BFF)',
                      color: 'var(--on, #FFFFFF)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      textDecoration: 'none',
                      border: '2px solid var(--line2, #0B0B0B)',
                    }}
                  >
                    Apply now ↗
                  </a>
                ) : (
                  <span
                    className="btn"
                    aria-disabled="true"
                    style={{ width: '100%', minHeight: 52, color: 'var(--dim, #5F5F5F)' }}
                  >
                    {isClosed ? 'Applications closed' : 'No link provided'}
                  </span>
                )}

                <span
                  className="m note"
                  style={{
                    textAlign: 'center',
                    font: '11px ui-monospace, Menlo, monospace',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: isClosed ? 'var(--bad, #C4321C)' : 'var(--dim, #5F5F5F)',
                  }}
                >
                  {applicationNote}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column (.rc) */}
          <div
            className="rc"
            style={{
              flex: '1 1 440px',
              padding: '36px 36px 32px',
              minWidth: 0,
              background: 'var(--panel, #F6F4EE)',
            }}
          >
            {/* Facts Grid matching Alumni-Jobs.html */}
            <FactsPanel facts={facts} />

            {/* About the role */}
            {job.description && (
              <div className="sc" style={{ marginBottom: 28 }}>
                <span
                  className="m"
                  style={{
                    display: 'block',
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--line, #CFCBBF)',
                    marginBottom: 14,
                    color: 'var(--ink, #0B0B0B)',
                    font: '11px ui-monospace, Menlo, monospace',
                    fontWeight: 700,
                  }}
                >
                  About the role
                </span>
                <p
                  className="t"
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--mut, #3B3A35)',
                    margin: 0,
                  }}
                >
                  {job.description}
                </p>
              </div>
            )}

            {/* Responsibilities */}
            {responsibilities.length > 0 && (
              <div className="sc" style={{ marginBottom: 28 }}>
                <span
                  className="m"
                  style={{
                    display: 'block',
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--line, #CFCBBF)',
                    marginBottom: 14,
                    color: 'var(--ink, #0B0B0B)',
                    font: '11px ui-monospace, Menlo, monospace',
                    fontWeight: 700,
                  }}
                >
                  Responsibilities
                </span>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {responsibilities.map((resp) => (
                    <li
                      key={resp}
                      style={{
                        position: 'relative',
                        padding: '7px 0 7px 22px',
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: 'var(--mut, #3B3A35)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 15,
                          width: 8,
                          height: 8,
                          background: 'var(--acc, #1F3BFF)',
                        }}
                      />
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requirements */}
            {requirements.length > 0 && (
              <div className="sc" style={{ marginBottom: 28 }}>
                <span
                  className="m"
                  style={{
                    display: 'block',
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--line, #CFCBBF)',
                    marginBottom: 14,
                    color: 'var(--ink, #0B0B0B)',
                    font: '11px ui-monospace, Menlo, monospace',
                    fontWeight: 700,
                  }}
                >
                  Requirements
                </span>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {requirements.map((req) => (
                    <li
                      key={req}
                      style={{
                        position: 'relative',
                        padding: '7px 0 7px 22px',
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: 'var(--mut, #3B3A35)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 15,
                          width: 8,
                          height: 8,
                          background: 'var(--acc, #1F3BFF)',
                        }}
                      />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div
          className="stick"
          style={{
            padding: '12px 16px',
            background: 'var(--panel, #F6F4EE)',
            borderTop: '2px solid var(--line2, #0B0B0B)',
          }}
        >
          {canApply ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn b"
              style={{ width: '100%', minHeight: 50, textDecoration: 'none' }}
            >
              Apply now ↗
            </a>
          ) : (
            <span className="btn" aria-disabled="true" style={{ width: '100%', minHeight: 50 }}>
              {isClosed ? 'Applications closed' : 'No link provided'}
            </span>
          )}
        </div>

        <div
          className="mfoot"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            borderTop: '2px solid var(--line2, #0B0B0B)',
            padding: '14px 20px',
            background: 'var(--bg, #ECE9E1)',
          }}
        >
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
