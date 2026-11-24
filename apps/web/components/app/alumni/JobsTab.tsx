'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { JobCard } from './JobCard';
import { JobDetailModal } from './JobDetailModal';
import { PostJobModal } from './PostJobModal';
import type { AlumniJob } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { can } from '@fecpc/contracts';

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: -12,
            marginBottom: 16,
          }}
        >
          <button type="button" className="btn sm" onClick={() => setPostModalOpen(true)}>
            + Add job
          </button>
        </div>
      )}

      {/* Sub-bar / Search & filter row */}
      <div
        className="bar"
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--panel, #F6F4EE)',
          border: '2px solid var(--line2, #0B0B0B)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        {/* Search input with SVG magnifying glass */}
        <div style={{ flex: '1 1 260px', position: 'relative', minWidth: 200 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              opacity: 0.6,
            }}
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
            style={{
              width: '100%',
              border: '2px solid var(--line2, #0B0B0B)',
              background: 'var(--bg, #FFFFFF)',
              color: 'var(--ink, #0B0B0B)',
              padding: '10px 14px 10px 40px',
              fontFamily: 'var(--sans)',
              fontSize: 14,
              borderRadius: 0,
            }}
          />
        </div>

        {/* Job type dropdown */}
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          aria-label="Job type"
          style={{
            border: '2px solid var(--line2, #0B0B0B)',
            background: 'var(--bg, #FFFFFF)',
            color: 'var(--ink, #0B0B0B)',
            padding: '10px 14px',
            fontFamily: 'var(--sans)',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 0,
            minWidth: 150,
          }}
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
          style={{
            border: '2px solid var(--line2, #0B0B0B)',
            background: 'var(--bg, #FFFFFF)',
            color: 'var(--ink, #0B0B0B)',
            padding: '10px 14px',
            fontFamily: 'var(--sans)',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 0,
            minWidth: 170,
          }}
        >
          <option value="soon">Closing soonest</option>
          <option value="new">Newest first</option>
          <option value="vac">Most vacancies</option>
        </select>

        {/* Segmented source toggle */}
        <div
          role="group"
          aria-label="Source"
          style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <button
            type="button"
            className={`tag tab ${source === '' ? 'on' : ''}`}
            onClick={() => setSource('')}
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button
            type="button"
            className={`tag tab ${source === 'manual' ? 'on' : ''}`}
            onClick={() => setSource('manual')}
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            Manual
          </button>
          <button
            type="button"
            className={`tag tab ${source === 'fetched' ? 'on' : ''}`}
            onClick={() => setSource('fetched')}
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            Fetched
          </button>
        </div>
      </div>

      {/* Count label */}
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--dim, #6B6B6B)',
          marginBottom: 16,
        }}
      >
        {total} {total === 1 ? 'role' : 'roles'}
      </div>

      {/* Job Grid / Loading / Empty */}
      {loading ? (
        <div
          className="gr"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: 24,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="panel"
              style={{
                height: 280,
                border: '2px solid var(--line2, #0B0B0B)',
                background: 'var(--panel, #F6F4EE)',
                opacity: 0.5,
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <div
          className="gr"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: 24,
          }}
        >
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onOpenDetail={handleOpenDetail} highlightQuery={q} />
          ))}
          {jobs.length < total && (
            <button
              type="button"
              className="btn sm line"
              style={{ gridColumn: '1 / -1', justifySelf: 'center' }}
              onClick={() => fetchJobs(jobs.length)}
            >
              Show more · {total - jobs.length} left
            </button>
          )}
        </div>
      ) : (
        <div
          className="panel"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            border: '2px solid var(--line2, #0B0B0B)',
            background: 'var(--panel, #F6F4EE)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 14,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--dim, #6B6B6B)',
              marginBottom: 16,
            }}
          >
            {hasActiveFilters ? 'NO ROLES MATCH THESE FILTERS.' : 'NO OPEN ROLES YET.'}
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn line sm"
              onClick={resetFilters}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Reset filters
            </button>
          ) : (
            canPost && (
              <button
                type="button"
                className="btn k sm"
                onClick={() => setPostModalOpen(true)}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
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
