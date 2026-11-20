'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlumniCard } from './AlumniCard';
import type { AlumniSummary } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';

export function AlumniTab({
  searchQuery,
  onOpenProfile,
  onCountChange,
}: {
  searchQuery?: string;
  onOpenProfile: (id: string) => void;
  onCountChange?: (total: number) => void;
}) {
  const { me } = useStore();
  const [q, setQ] = useState(searchQuery ?? '');
  const [batch, setBatch] = useState('all');
  const [location, setLocation] = useState('all');
  const [mentoringOnly, setMentoringOnly] = useState(false);

  const [alumni, setAlumni] = useState<AlumniSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batchOptions, setBatchOptions] = useState<number[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

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

  const fetchAlumni = useCallback(
    async (targetPage = 0, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const res = await fetch('/api/alumni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'listAlumni',
            q: q.trim() || undefined,
            batch: batch !== 'all' ? batch : undefined,
            location: location !== 'all' ? location : undefined,
            mentoringOnly: mentoringOnly ? true : undefined,
            page: targetPage,
            pageSize: 16,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            alumni: AlumniSummary[];
            total: number;
            hasMore: boolean;
            batchOptions: number[];
            locationOptions: string[];
          };

          if (append) {
            setAlumni((prev) => [...prev, ...data.alumni]);
          } else {
            setAlumni(data.alumni);
          }
          setTotal(data.total);
          setHasMore(data.hasMore);
          setPage(targetPage);
          if (data.batchOptions?.length) setBatchOptions(data.batchOptions);
          if (data.locationOptions?.length) setLocationOptions(data.locationOptions);
          onCountChangeRef.current?.(data.total);
        }
      } catch {
        // network error
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [q, batch, location, mentoringOnly],
  );

  // Trigger search on filter change
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void fetchAlumni(0, false);
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [fetchAlumni]);

  const handleToggleSave = async (alumniId: string): Promise<boolean | void> => {
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'saveAlumni', alumniId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { saved: boolean };
        setAlumni((prev) => prev.map((a) => (a.id === alumniId ? { ...a, saved: data.saved } : a)));
        return data.saved;
      }
    } catch {
      // ignore
    }
  };

  const handleResetFilters = () => {
    setQ('');
    setBatch('all');
    setLocation('all');
    setMentoringOnly(false);
  };

  const isFiltered = Boolean(q.trim()) || batch !== 'all' || location !== 'all' || mentoringOnly;

  return (
    <div className="alumni-tab-view">
      {/* Subtitle matching mockup 30d77ff9 */}
      <p
        className="t"
        style={{
          maxWidth: 560,
          margin: '-8px 0 24px',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--mut, #3B3A35)',
        }}
      >
        Ask about interviews, careers and life after graduation.
      </p>

      {/* Filter Row (.pn) matching mockup 30d77ff9 */}
      <div
        className="pn"
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: 16,
          background: 'var(--panel, #F6F4EE)',
          border: '2px solid var(--line2, #0B0B0B)',
          marginBottom: 24,
        }}
      >
        {/* Search input */}
        <div style={{ flex: '1 1 280px' }}>
          <input
            type="search"
            aria-label="Search"
            placeholder="Search name, batch, location, role or company"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              border: '2px solid var(--line2, #0B0B0B)',
              background: 'var(--bg, #F6F4EE)',
              padding: '12px 14px',
              font: '14px Inter, Arial, sans-serif',
              minHeight: 44,
              color: 'var(--ink, #0B0B0B)',
              width: '100%',
            }}
          />
        </div>

        {/* Batch select */}
        <div style={{ flex: '0 0 170px' }}>
          <select
            aria-label="Batch"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            style={{
              border: '2px solid var(--line2, #0B0B0B)',
              background: 'var(--bg, #F6F4EE)',
              padding: '12px 14px',
              font: '14px Inter, Arial, sans-serif',
              minHeight: 44,
              color: 'var(--ink, #0B0B0B)',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <option value="all">All batches</option>
            {batchOptions.map((b) => (
              <option key={b} value={b}>
                Batch {b}
              </option>
            ))}
          </select>
        </div>

        {/* Location select */}
        <div style={{ flex: '0 0 170px' }}>
          <select
            aria-label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{
              border: '2px solid var(--line2, #0B0B0B)',
              background: 'var(--bg, #F6F4EE)',
              padding: '12px 14px',
              font: '14px Inter, Arial, sans-serif',
              minHeight: 44,
              color: 'var(--ink, #0B0B0B)',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <option value="all">All locations</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Segmented Mentoring Filter */}
        <div className="ty" style={{ display: 'flex', gap: 8, marginLeft: 0 }}>
          <button
            type="button"
            className={`ch ${!mentoringOnly ? 'on' : ''}`}
            onClick={() => setMentoringOnly(false)}
            style={{
              font: '12px ui-monospace, Menlo, monospace',
              textTransform: 'uppercase',
              letterSpacing: 1,
              border: '2px solid var(--line2, #0B0B0B)',
              padding: '10px 14px',
              background: !mentoringOnly ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
              color: !mentoringOnly ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button
            type="button"
            className={`ch ${mentoringOnly ? 'on' : ''}`}
            onClick={() => setMentoringOnly(true)}
            style={{
              font: '12px ui-monospace, Menlo, monospace',
              textTransform: 'uppercase',
              letterSpacing: 1,
              border: '2px solid var(--line2, #0B0B0B)',
              padding: '10px 14px',
              background: mentoringOnly ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
              color: mentoringOnly ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            Available only
          </button>
        </div>
      </div>

      {/* Grid (.gr) */}
      {loading && alumni.length === 0 ? (
        <div
          className="gr"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 24,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              style={{
                height: 320,
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      ) : alumni.length === 0 ? (
        <div
          className="pn"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
          }}
        >
          <p
            className="m"
            style={{
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isFiltered ? 'NO ALUMNI MATCH THESE FILTERS.' : 'NO ALUMNI REGISTERED YET.'}
          </p>
          {isFiltered && (
            <button
              type="button"
              className="btn sm"
              onClick={handleResetFilters}
              style={{
                font: '500 13px Inter, Arial, sans-serif',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: '0 16px',
                background: 'var(--panel, #F6F4EE)',
                minHeight: 36,
                cursor: 'pointer',
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="gr"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 24,
            }}
          >
            {alumni.map((a) => (
              <AlumniCard
                key={a.id}
                alumnus={a}
                isOwnCard={a.id === me.id}
                onOpenProfile={onOpenProfile}
                onToggleSave={handleToggleSave}
                highlightQuery={q}
              />
            ))}
          </div>

          {/* Footer showing count + Load more button */}
          <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 24 }}>
            <div
              className="m"
              style={{
                marginBottom: 12,
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
              }}
            >
              Showing {alumni.length} of {total}
            </div>
            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void fetchAlumni(page + 1, true)}
                style={{
                  font: '500 13px Inter, Arial, sans-serif',
                  border: '2px solid var(--line2, #0B0B0B)',
                  padding: '0 24px',
                  background: 'var(--panel, #F6F4EE)',
                  minHeight: 44,
                  color: 'var(--ink, #0B0B0B)',
                  cursor: 'pointer',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                }}
              >
                {loadingMore ? 'Loading more…' : 'Load more'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AlumniTab;
