'use client';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { JobCard } from './JobCard';
import type { AlumniJob } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { can } from '@fecpc/contracts';

// Opened on demand: the dialog's code loads when it is first shown.
const JobDetailModal = dynamic(() => import('./JobDetailModal').then((m) => m.JobDetailModal));
const PostJobModal = dynamic(() => import('./PostJobModal').then((m) => m.PostJobModal));

const sourceTab =
  'py-2 px-3.5 [font-family:var(--mono)] text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer';

export function JobsTab({
  searchQuery,
  activeJobId,
  onSelectJob,
  onCountChange,
  onShowToast,
}: {
  searchQuery?: string;
  activeJobId?: number | null;
  onSelectJob?: (id: number | null) => void;
  onCountChange?: (total: number) => void;
  onShowToast?: (msg: string) => void;
}) {
  const { s } = useStore();
  const canPost = can(s.roles, 'alumni.job.post') || s.role === 'alumni';

  const [q, setQ] = useState(searchQuery ?? '');
  const [jobType, setJobType] = useState('all');
  const [sort, setSort] = useState<'soon' | 'new' | 'vac'>('soon');
  const [source, setSource] = useState<'' | 'manual' | 'fetched'>('');

  const [jobs, setJobs] = useState<AlumniJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedJob, setSelectedJob] = useState<AlumniJob | null>(null);
  const [postModalOpen, setPostModalOpen] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  // Sync external search query
  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== q) {
      setQ(searchQuery);
    }
  }, [searchQuery]);

  // The server sends 30 jobs at a time; `more` appends the next 30 to the list.
  const fetchJobs = useCallback(
    async (offset = 0) => {
      if (!offset) setLoading(true);
      try {
        const res = await fetch('/api/alumni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'listAlumniJobs',
            q: q.trim() || undefined,
            type: jobType !== 'all' ? jobType : undefined,
            sort,
            source: source || undefined,
            offset,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { jobs: AlumniJob[]; total: number };
          setJobs((prev) => (offset ? [...prev, ...(data.jobs || [])] : data.jobs || []));
          if (!offset || data.jobs?.length) {
            setTotal(data.total || 0);
            onCountChangeRef.current?.(data.total || 0);
          }
        }
      } catch (err) {
        console.error('Failed to load jobs', err);
      } finally {
        setLoading(false);
      }
    },
    [q, jobType, sort, source],
  );

  // Debounced search trigger
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchJobs();
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [fetchJobs]);

  // Sync activeJobId from props
  useEffect(() => {
    if (activeJobId && jobs.length > 0) {
      const found = jobs.find((j) => j.id === activeJobId);
      if (found) setSelectedJob(found);
    } else if (!activeJobId) {
      setSelectedJob(null);
    }
  }, [activeJobId, jobs]);

  const handleOpenDetail = (job: AlumniJob) => {
    setSelectedJob(job);
    onSelectJob?.(job.id);
  };

  const handleCloseDetail = () => {
    setSelectedJob(null);
    onSelectJob?.(null);
  };

  const handleJobDeleted = (jobId: number) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setTotal((prev) => Math.max(0, prev - 1));
    handleCloseDetail();
    onShowToast?.('Job deleted');
  };

  const handleJobCreated = (newJob: AlumniJob) => {
    setJobs((prev) => [newJob, ...prev]);
    setTotal((prev) => prev + 1);
    setPostModalOpen(false);
    onShowToast?.('Job posted');
    fetchJobs();
  };

  const resetFilters = () => {
    setQ('');
    setJobType('all');
    setSort('soon');
    setSource('');
  };

  const hasActiveFilters = Boolean(q.trim() || jobType !== 'all' || sort !== 'soon' || source);

  return (
    <div>
      {canPost && (
        <div className="-mt-3 mb-4 flex justify-end">
          <button type="button" className="btn sm" onClick={() => setPostModalOpen(true)}>
            + Add job
          </button>
        </div>
      )}

      {/* Sub-bar / Search & filter row */}
      <div className="bar p-4 mb-5 flex gap-3 flex-wrap items-center [background:var(--panel)] [border:2px_solid_var(--line2)]">
        {/* Search input with SVG magnifying glass */}
        <div className="flex-[1_1_260px] relative min-w-[200px]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
            className="top-[50%] left-3.5 absolute [transform:translateY(-50%)] pointer-events-none opacity-[0.6]"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="m11 11 3.5 3.5" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, role or location"
            aria-label="Search jobs"
            className="py-2.5 pr-3.5 pl-10 w-full [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink [font-family:var(--sans)] text-[14px] [border-radius:0]"
          />
        </div>

        {/* Job type dropdown */}
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          aria-label="Job type"
          className="py-2.5 px-3.5 [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink [font-family:var(--sans)] text-[13px] font-semibold [border-radius:0] min-w-[150px]"
        >
          <option value="all">All job types</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Contract">Contract</option>
          <option value="Internship">Internship</option>
        </select>

        {/* Sort dropdown */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'soon' | 'new' | 'vac')}
          aria-label="Sort"
          className="py-2.5 px-3.5 [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink [font-family:var(--sans)] text-[13px] font-semibold [border-radius:0] min-w-[170px]"
        >
          <option value="soon">Closing soonest</option>
          <option value="new">Newest first</option>
          <option value="vac">Most vacancies</option>
        </select>

        {/* Segmented source toggle */}
        <div role="group" aria-label="Source" className="inline-flex gap-1 flex-wrap items-center">
          <button
            type="button"
            className={`tag tab ${source === '' ? 'on' : ''} ${sourceTab}`}
            onClick={() => setSource('')}
          >
            All
          </button>
          <button
            type="button"
            className={`tag tab ${source === 'manual' ? 'on' : ''} ${sourceTab}`}
            onClick={() => setSource('manual')}
          >
            Manual
          </button>
          <button
            type="button"
            className={`tag tab ${source === 'fetched' ? 'on' : ''} ${sourceTab}`}
            onClick={() => setSource('fetched')}
          >
            Fetched
          </button>
        </div>
      </div>

      {/* Count label */}
      <div className="mb-4 [font-family:var(--mono)] text-[12px] font-bold uppercase tracking-[0.08em] text-dim">
        {total} {total === 1 ? 'role' : 'roles'}
      </div>

      {/* Job Grid / Loading / Empty */}
      {loading ? (
        <div className="gr [display:grid] grid-cols-[repeat(auto-fill,_minmax(310px,_1fr))] gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="panel h-[280px] [border:2px_solid_var(--line2)] [background:var(--panel)] opacity-[0.5] [animation:pulse_1.5s_infinite_ease-in-out]"
            />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <div className="gr [display:grid] grid-cols-[repeat(auto-fill,_minmax(310px,_1fr))] gap-6">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onOpenDetail={handleOpenDetail} highlightQuery={q} />
          ))}
          {jobs.length < total && (
            <button
              type="button"
              className="btn sm line col-span-full [justify-self:center]"
              onClick={() => fetchJobs(jobs.length)}
            >
              Show more · {total - jobs.length} left
            </button>
          )}
        </div>
      ) : (
        <div className="panel py-12 px-6 text-center [border:2px_solid_var(--line2)] [background:var(--panel)]">
          <div className="mb-4 [font-family:var(--mono)] text-[14px] font-bold uppercase tracking-[0.08em] text-dim">
            {hasActiveFilters ? 'NO ROLES MATCH THESE FILTERS.' : 'NO OPEN ROLES YET.'}
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn line sm [font-family:var(--mono)] text-[12px] font-bold uppercase cursor-pointer"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          ) : (
            canPost && (
              <button
                type="button"
                className="btn k sm [font-family:var(--mono)] text-[12px] font-bold uppercase cursor-pointer"
                onClick={() => setPostModalOpen(true)}
              >
                + Post the first role
              </button>
            )
          )}
        </div>
      )}

      {/* Modals */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={handleCloseDetail}
          onDeleted={handleJobDeleted}
        />
      )}

      {postModalOpen && (
        <PostJobModal onClose={() => setPostModalOpen(false)} onJobCreated={handleJobCreated} />
      )}
    </div>
  );
}
