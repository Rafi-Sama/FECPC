'use client';
import { DatePicker } from '@/components/app/shared/DatePicker';
import { SaveForm } from '@/components/app/SaveBar';
import React, { useEffect, useRef, useState } from 'react';
import type { AlumniJob } from '@fecpc/contracts';
import { JobCard } from './JobCard';

const stepperButton =
  'w-[38px] h-[38px] [border:none] [background:transparent] text-[16px] font-bold cursor-pointer text-ink';

const label = 'm mb-1.5 block text-dim';
const inputBase = 'btn line w-full text-left [background:var(--bg)] text-ink';
const input = `${inputBase} min-h-[40px]`;
const errorText = 'mt-1 text-[11px] text-acc block';
const grid2 = '[display:grid] grid-cols-[1fr_1fr] gap-4';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PostJobModal({
  onClose,
  onJobCreated,
}: {
  onClose: () => void;
  onJobCreated: (job: AlumniJob) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [vacancies, setVacancies] = useState(1);
  const [jobType, setJobType] = useState('Full-time');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [experience, setExperience] = useState('');
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilitiesText, setResponsibilitiesText] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Set default deadline to 14 days from today
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDeadline(d.toISOString().slice(0, 10));
  }, []);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Initial focus + Esc
  useEffect(() => {
    companyInputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (!active || active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modalRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Real-time preview job object
  const previewJob: AlumniJob = {
    id: 9999,
    company: company.trim() || 'Your Company',
    role: role.trim() || 'Software Engineer',
    title: role.trim() || 'Software Engineer',
    vacancies,
    job_type: jobType,
    location: location.trim() || 'Dhaka · Hybrid',
    url: url.trim() || 'https://example.com/careers',
    deadline: deadline || null,
    source: 'manual',
    company_logo_url: companyLogoUrl.trim() || null,
    experience: experience.trim() || null,
    salary: salary.trim() || null,
    description: description.trim() || null,
    responsibilities: responsibilitiesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    requirements: requirementsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    mine: true,
    alumni_id: 'preview',
    fetched_at: null,
    created_at: new Date().toISOString(),
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!company.trim()) newErrors.company = 'Company name is required';
    if (!role.trim()) newErrors.role = 'Role title is required';
    if (!url.trim()) {
      newErrors.url = 'Application URL is required';
    } else {
      try {
        new URL(url.trim());
      } catch {
        newErrors.url = 'Enter a valid URL (e.g. https://...)';
      }
    }
    if (!deadline) newErrors.deadline = 'Closing deadline is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Focus first error
      if (newErrors.company) companyInputRef.current?.focus();
      return Object.values(newErrors).join('\n');
    }

    setErrors({});

    try {
      const responsibilities = responsibilitiesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const requirements = requirementsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'createAlumniJob',
          company: company.trim(),
          title: role.trim(),
          role: role.trim(),
          vacancies,
          job_type: jobType,
          location: location.trim() || null,
          url: url.trim(),
          deadline,
          experience: experience.trim() || null,
          salary: salary.trim() || null,
          description: description.trim() || null,
          responsibilities,
          requirements,
          company_logo_url: companyLogoUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrors({ form: j.error ?? 'Failed to post job.' });
        return String(j.error ?? 'Failed to post job.');
      }

      const created = (await res.json()) as AlumniJob;
      onJobCreated({
        ...previewJob,
        ...created,
      });
      onClose();
      return true;
    } catch {
      setErrors({ form: 'You seem to be offline. The job was not posted.' });
      return 'You seem to be offline. The job was not posted.';
    }
  };

  return (
    <div
      className="profile-modal-backdrop post-job-backdrop inset-0 p-4 fixed [background:rgba(11,_11,_11,_0.65)] [backdrop-filter:blur(4px)] flex items-center justify-center z-[9999]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="panel max-[861px]:max-h-[100vh]! max-[861px]:min-h-[100vh] p-0 w-full max-w-[1040px] max-h-[90vh] [background:var(--panel)] [border:2px_solid_var(--line2)] [box-shadow:10px_10px_0_var(--line2)] flex flex-col overflow-hidden relative"
        role="dialog"
        aria-modal="true"
        aria-label="Post a new job"
      >
        {/* Top Header */}
        <header className="py-4 px-6 flex justify-between items-center [border-bottom:2px_solid_var(--line2)] [background:var(--bg)]">
          <div>
            <span className="m text-[11px] font-semibold text-acc tracking-[.08em] block">
              MANUAL · SHARED WITH ALL ALUMNI
            </span>
            <h2 className="mt-0.5 mx-0 mb-0 text-[20px] font-bold text-ink">
              Post a <i className="text-acc not-italic">job.</i>
            </h2>
          </div>

          <button
            type="button"
            className="btn xs line p-0 min-w-[36px] min-h-[36px] text-[18px] text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {/* Modal Body: Two Columns (Form on Left, Sticky Live Preview on Right) */}
        <div className="max-[861px]:[&>form]:[border-right:0]! max-[861px]:[&>form]:[border-bottom:1px_solid_var(--line)] max-[861px]:grid-cols-[1fr]! [display:grid] grid-cols-[1fr_340px] overflow-y-auto flex-1">
          {/* Form */}
          <SaveForm
            onSubmit={handleSubmit}
            onDiscard={onClose}
            label="Unpublished job"
            saveLabel="Publish job"
            className="py-6 px-8 flex flex-col gap-4 [border-right:2px_solid_var(--line2)]"
          >
            {errors.form && (
              <div className="py-2.5 px-3.5 [background:rgba(176,_0,_32,_0.12)] [border:2px_solid_var(--acc)] text-acc text-[13px] font-medium">
                {errors.form}
              </div>
            )}

            {/* Row 1: Company + Role */}
            <div className={grid2}>
              <div>
                <label className={label}>COMPANY NAME *</label>
                <input
                  ref={companyInputRef}
                  className={input}
                  required
                  placeholder="e.g. Northwind Labs"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  style={{
                    borderColor: errors.company ? 'var(--acc, #B00020)' : 'var(--line2, #0B0B0B)',
                  }}
                />
                {errors.company && <span className={errorText}>{errors.company}</span>}
              </div>

              <div>
                <label className={label}>ROLE TITLE *</label>
                <input
                  className={input}
                  required
                  placeholder="e.g. Frontend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    borderColor: errors.role ? 'var(--acc, #B00020)' : 'var(--line2, #0B0B0B)',
                  }}
                />
                {errors.role && <span className={errorText}>{errors.role}</span>}
              </div>
            </div>

            {/* Row 2: Vacancies Stepper + Job Type */}
            <div className="[display:grid] grid-cols-[140px_1fr] gap-4">
              <div>
                <label className={label}>VACANCIES</label>
                <div className="flex items-center [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink">
                  <button
                    type="button"
                    onClick={() => setVacancies((v) => Math.max(1, v - 1))}
                    className={stepperButton}
                  >
                    -
                  </button>
                  <span className="flex-1 text-center [font-family:ui-monospace,_monospace] font-bold text-[15px]">
                    {vacancies}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVacancies((v) => Math.min(99, v + 1))}
                    className={stepperButton}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className={label}>JOB TYPE</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`tag tab ${jobType === type ? 'on' : ''} min-h-[38px] text-[12px]`}
                      onClick={() => setJobType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Location + Deadline */}
            <div className={grid2}>
              <div>
                <label className={label}>LOCATION</label>
                <input
                  className={`${input} border-line2`}
                  placeholder="Dhaka · Hybrid / Remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div>
                <label className={label}>CLOSING DEADLINE *</label>
                <DatePicker
                  className="grow"
                  label="Closing deadline"
                  required
                  invalid={!!errors.deadline}
                  value={deadline}
                  onChange={setDeadline}
                />
                {errors.deadline && <span className={errorText}>{errors.deadline}</span>}
              </div>
            </div>

            {/* Row 4: Application URL + Experience */}
            <div className={grid2}>
              <div>
                <label className={label}>APPLICATION URL *</label>
                <input
                  type="url"
                  className={input}
                  required
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={{
                    borderColor: errors.url ? 'var(--acc, #B00020)' : 'var(--line2, #0B0B0B)',
                  }}
                />
                {errors.url && <span className={errorText}>{errors.url}</span>}
              </div>

              <div>
                <label className={label}>EXPERIENCE (OPTIONAL)</label>
                <input
                  className={`${input} border-line2`}
                  placeholder="e.g. 2–4 years"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                />
              </div>
            </div>

            {/* Row 5: Salary + Logo URL */}
            <div className={grid2}>
              <div>
                <label className={label}>SALARY / STIPEND (OPTIONAL)</label>
                <input
                  className={`${input} border-line2`}
                  placeholder="e.g. ৳70k–110k"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </div>

              <div>
                <label className={label}>COMPANY LOGO URL (OPTIONAL)</label>
                <input
                  type="url"
                  className={`${input} border-line2`}
                  placeholder="https://.../logo.png"
                  value={companyLogoUrl}
                  onChange={(e) => setCompanyLogoUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={label}>ABOUT THE ROLE (OPTIONAL)</label>
              <textarea
                className={`${inputBase} min-h-[70px] border-line2 [font-family:inherit] resize-y`}
                rows={3}
                placeholder="Give candidates an overview of the company, team and what you are building…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Responsibilities (one per line) */}
            <div>
              <label className={label}>RESPONSIBILITIES (ONE PER LINE)</label>
              <textarea
                className={`${inputBase} min-h-[70px] border-line2 [font-family:inherit] resize-y`}
                rows={3}
                placeholder="Build and maintain React interfaces&#10;Turn designs into accessible components&#10;Review pull requests"
                value={responsibilitiesText}
                onChange={(e) => setResponsibilitiesText(e.target.value)}
              />
            </div>

            {/* Requirements (one per line) */}
            <div>
              <label className={label}>REQUIREMENTS (ONE PER LINE)</label>
              <textarea
                className={`${inputBase} min-h-[70px] border-line2 [font-family:inherit] resize-y`}
                rows={3}
                placeholder="2+ years of professional React experience&#10;Comfortable with TypeScript&#10;Clear written English"
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
              />
            </div>
            <button type="submit" className="btn">
              Publish job
            </button>
          </SaveForm>

          {/* Right Column: Sticky Live Preview */}
          <aside className="py-6 px-5 [background:var(--bg)] flex flex-col gap-4">
            <div>
              <span className="m mb-3 text-[11px] font-bold tracking-[.08em] text-dim block">
                LIVE PREVIEW
              </span>
              <p className="mt-0 mx-0 mb-4 text-[12px] text-dim">
                This is how alumni and students will see your posting in the Jobs directory.
              </p>
            </div>

            <div className="pointer-events-none">
              <JobCard job={previewJob} onOpenDetail={() => {}} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default PostJobModal;
