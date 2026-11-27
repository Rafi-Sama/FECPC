'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlumniCard } from './AlumniCard';
import type { AlumniSummary } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';

import { filterChip, emptyPanel, listKicker } from '@/components/app/alumni/ui';

const searchInput =
  'py-3 px-3.5 [border:2px_solid_var(--line2)] [background:var(--bg)] [font:14px_Inter,_Arial,_sans-serif] min-h-[44px] text-ink w-full cursor-pointer';

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
  const [availableOnly, setAvailableOnly] = useState(false);

  const [alumni, setAlumni] = useState<AlumniSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batchOptions, setBatchOptions] = useState<number[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the latest request may fill the list: an older, slower answer arriving later is dropped.
  const reqSeq = useRef(0);
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
      const mine = ++reqSeq.current;
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
            availableOnly: availableOnly ? true : undefined,
            page: targetPage,
            pageSize: 16,
          }),
        });

        if (res.ok && mine === reqSeq.current) {
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
        if (mine === reqSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [q, batch, location, availableOnly],
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
    setAvailableOnly(false);
  };

  const isFiltered = Boolean(q.trim()) || batch !== 'all' || location !== 'all' || availableOnly;

  return (
    <div className="alumni-tab-view">
      {/* Subtitle matching mockup 30d77ff9 */}
      <p className="t -mt-2 mx-0 mb-6 max-w-[560px] text-[14px] leading-[1.55] text-mut">
        Ask about interviews, careers and life after graduation.
      </p>

      {/* Filter Row (.pn) matching mockup 30d77ff9 */}
      <div className="pn p-4 mb-6 flex gap-4 flex-wrap items-center [background:var(--panel)] [border:2px_solid_var(--line2)]">
        {/* Search input */}
        <div className="flex-[1_1_280px]">
          <input
            type="search"
            aria-label="Search"
            placeholder="Search name, batch, location, role or company"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="py-3 px-3.5 [border:2px_solid_var(--line2)] [background:var(--bg)] [font:14px_Inter,_Arial,_sans-serif] min-h-[44px] text-ink w-full"
          />
        </div>

        {/* Batch select */}
        <div className="flex-[0_0_170px]">
          <select
            aria-label="Batch"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className={searchInput}
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
        <div className="flex-[0_0_170px]">
          <select
            aria-label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={searchInput}
          >
            <option value="all">All locations</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Segmented availability filter */}
        <div className="ty ml-0 flex gap-2">
          <button
            type="button"
            className={`${!availableOnly ? 'on' : ''} ${filterChip}`}
            onClick={() => setAvailableOnly(false)}
            style={{
              background: !availableOnly ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
              color: !availableOnly ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
            }}
          >
            All
          </button>
          <button
            type="button"
            className={`${availableOnly ? 'on' : ''} ${filterChip}`}
            onClick={() => setAvailableOnly(true)}
            style={{
              background: availableOnly ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
              color: availableOnly ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
            }}
          >
            Available only
          </button>
        </div>
      </div>

      {/* Grid (.gr) */}
      {loading && alumni.length === 0 ? (
        <div className="gr [display:grid] grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-6">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-[320px] [background:var(--panel)] [border:2px_solid_var(--line2)] opacity-[0.6]"
            />
          ))}
        </div>
      ) : alumni.length === 0 ? (
        <div className={emptyPanel}>
          <p className={listKicker}>
            {isFiltered ? 'NO ALUMNI MATCH THESE FILTERS.' : 'NO ALUMNI REGISTERED YET.'}
          </p>
          {isFiltered && (
            <button
              type="button"
              className="btn sm py-0 px-4 [font:500_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] min-h-[36px] cursor-pointer"
              onClick={handleResetFilters}
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="gr [display:grid] grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-6">
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
          <div className="mt-10 mb-6 text-center">
            <div className="m mb-3 [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
              Showing {alumni.length} of {total}
            </div>
            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void fetchAlumni(page + 1, true)}
                className="py-0 px-6 [font:500_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] min-h-[44px] text-ink cursor-pointer tracking-[.04em] uppercase"
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
