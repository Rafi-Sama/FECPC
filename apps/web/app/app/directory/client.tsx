'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { MemberCard } from '@/components/app/members/MemberCard';
import { MemberFilters, type MemberFilterState } from '@/components/app/members/MemberFilters';
import { canFully, isAdmin } from '@fecpc/contracts';
import { AddMemberModal } from '@/components/app/members/AddMemberModal';
import type { MemberSummary } from '@fecpc/contracts';

// Opened on demand: the dialog's code loads when it is first shown.
const ProfileModal = dynamic(() =>
  import('@/components/app/members/ProfileModal').then((m) => m.ProfileModal),
);

const PAGE_SIZE = 16;

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function buildQuery(filters: MemberFilterState, page: number, profileId: string | null): string {
  const sp = new URLSearchParams();
  if (filters.q.trim()) sp.set('q', filters.q.trim());
  if (filters.rating) sp.set('rating', filters.rating);
  if (filters.skill) sp.set('skill', filters.skill);
  if (filters.batch) sp.set('batch', filters.batch);
  if (page > 0) sp.set('page', String(page));
  if (profileId) sp.set('profile', profileId);
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** The first page of `listMembers` for the URL's filters, rendered with the HTML by page.tsx. */
export type MembersInitial = {
  members: MemberSummary[];
  total: number;
  clubTotal: number;
  hasMore: boolean;
  skills: string[];
  batches: number[];
};

function MembersInner({ initial }: { initial: MembersInitial | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { s, counts } = useStore();
  const [adding, setAdding] = useState(false);
  const current = counts.peopleCount - (counts.alumniCount ?? 0); // the directory lists current members

  // Initial URL state
  const urlQ = searchParams.get('q') ?? '';
  const urlRating = searchParams.get('rating') ?? '';
  const urlSkill = searchParams.get('skill') ?? '';
  const urlBatch = searchParams.get('batch') ?? '';
  const urlPage = parsePage(searchParams.get('page'));
  const urlProfile = searchParams.get('profile');

  const [qInput, setQInput] = useState(urlQ);
  const [debouncedQ, setDebouncedQ] = useState(urlQ);
  const [rating, setRating] = useState(urlRating);
  const [skill, setSkill] = useState(urlSkill);
  const [batch, setBatch] = useState(urlBatch);
  const [page, setPage] = useState(urlPage);

  const [items, setItems] = useState<MemberSummary[]>(initial?.members ?? []);
  const [total, setTotal] = useState<number>(initial?.total ?? current);
  const [clubTotal, setClubTotal] = useState<number>(initial?.clubTotal ?? current);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [skillOptions, setSkillOptions] = useState<string[]>(initial?.skills ?? []);
  const [batchOptions, setBatchOptions] = useState<number[]>(initial?.batches ?? []);
  const [loading, setLoading] = useState(!initial);
  const served = useRef(!!initial); // the server already sent the first list for these filters
  const [loadingMore, setLoadingMore] = useState(false);

  const reqSeq = useRef(0);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const pushedProfileRef = useRef(false);
  const restoredScrollRef = useRef(false);

  // The query string this page last wrote. When the URL changes to it, that is our own echo (it arrives after the
  // debounce, while the person may still be typing) and must not overwrite the box; only Back/Forward or a link
  // brings a URL we did not write.
  const wroteQs = useRef<string | null>(null);
  const urlQs = searchParams.toString() ? `?${searchParams.toString()}` : '';

  // Sync local filter controls if URL changes via browser Back/Forward
  useEffect(() => {
    if (urlQs === wroteQs.current) return;
    setQInput(urlQ);
    setDebouncedQ(urlQ);
    setRating(urlRating);
    setSkill(urlSkill);
    setBatch(urlBatch);
    setPage(urlPage);
  }, [urlQ, urlRating, urlSkill, urlBatch, urlPage]);

  // Debounce text input by 250ms
  useEffect(() => {
    const t = setTimeout(() => {
      const next = qInput.trim();
      setDebouncedQ((prev) => {
        if (prev !== next) {
          setPage(0);
        }
        return next;
      });
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);

  const filterState: MemberFilterState = useMemo(
    () => ({ q: qInput, rating, skill, batch }),
    [qInput, rating, skill, batch],
  );

  const appliedFilters: MemberFilterState = useMemo(
    () => ({ q: debouncedQ, rating, skill, batch }),
    [debouncedQ, rating, skill, batch],
  );

  const hasActiveFilters = Boolean(debouncedQ || rating || skill || batch);

  // Persist filters & page in URL query string without wiping active ?profile=
  useEffect(() => {
    const nextQs = buildQuery(appliedFilters, page, urlProfile);
    const curQs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    if (nextQs !== curQs) {
      wroteQs.current = nextQs;
      router.replace(`${pathname}${nextQs}`, { scroll: false });
    }
  }, [appliedFilters, page, urlProfile, pathname, router, searchParams]);

  // Save scroll position per filter query so Back restores position
  const scrollKey = `members:scroll:${buildQuery(appliedFilters, page, null)}`;
  useEffect(() => {
    const onScroll = () => {
      try {
        sessionStorage.setItem(scrollKey, String(window.scrollY));
      } catch {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollKey]);

  // Fetch members for current filters (and restore up to `page` pages on mount/back)
  const fetchList = useCallback(
    async (targetPage: number, mode: 'replace' | 'append') => {
      const seq = ++reqSeq.current;
      if (mode === 'append') setLoadingMore(true);
      else setLoading(true);

      try {
        // When replacing with page > 0 (e.g. Back navigation to ?page=2), load pages 0..targetPage in one slice
        const reqPage = mode === 'append' ? targetPage : 0;
        const reqPageSize = mode === 'append' ? PAGE_SIZE : (targetPage + 1) * PAGE_SIZE;

        const res = await fetch('/api/members', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'listMembers',
            q: appliedFilters.q || undefined,
            rating: appliedFilters.rating || undefined,
            skill: appliedFilters.skill || undefined,
            batch: appliedFilters.batch ? Number(appliedFilters.batch) : undefined,
            page: reqPage,
            pageSize: reqPageSize,
          }),
        });
        if (!res.ok || seq !== reqSeq.current) return;
        const data = (await res.json()) as {
          members?: MemberSummary[];
          items?: MemberSummary[];
          total?: number;
          clubTotal?: number;
          hasMore?: boolean;
          skills?: string[];
          batches?: number[];
        };

        const membersList: MemberSummary[] = Array.isArray(data?.members)
          ? data.members
          : Array.isArray(data?.items)
            ? data.items
            : [];

        setItems((prev) => {
          if (mode === 'replace') return membersList;
          const seen = new Set((prev ?? []).map((m) => m.id));
          return [...(prev ?? []), ...membersList.filter((m) => !seen.has(m.id))];
        });
        setTotal(typeof data?.total === 'number' ? data.total : membersList.length);
        setClubTotal(
          typeof data?.clubTotal === 'number'
            ? data.clubTotal
            : (data?.total ?? membersList.length),
        );
        setHasMore(Boolean(data?.hasMore));
        setSkillOptions(Array.isArray(data?.skills) ? data.skills : []);
        setBatchOptions(Array.isArray(data?.batches) ? data.batches : []);

        if (mode === 'replace' && !restoredScrollRef.current) {
          restoredScrollRef.current = true;
          try {
            const savedY = Number(sessionStorage.getItem(scrollKey));
            if (Number.isFinite(savedY) && savedY > 0) {
              requestAnimationFrame(() => window.scrollTo(0, savedY));
            }
          } catch {}
        }
      } finally {
        if (seq === reqSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [appliedFilters, scrollKey],
  );

  // Trigger fetch whenever applied filters change
  useEffect(() => {
    if (served.current) return void (served.current = false);
    void fetchList(page, 'replace');
  }, [appliedFilters.q, appliedFilters.rating, appliedFilters.skill, appliedFilters.batch]);

  const handleFilterChange = (patch: Partial<MemberFilterState>) => {
    if ('q' in patch) {
      setQInput(patch.q ?? '');
      return;
    }
    if ('rating' in patch) setRating(patch.rating ?? '');
    if ('skill' in patch) setSkill(patch.skill ?? '');
    if ('batch' in patch) setBatch(patch.batch ?? '');
    setPage(0);
  };

  const handleReset = () => {
    setQInput('');
    setDebouncedQ('');
    setRating('');
    setSkill('');
    setBatch('');
    setPage(0);
    wroteQs.current = '';
    router.replace(pathname, { scroll: false });
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchList(nextPage, 'append');
  };

  const handleOpenProfile = (id: string, trigger?: HTMLElement | null) => {
    lastTriggerRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    pushedProfileRef.current = true;
    const nextQs = buildQuery(appliedFilters, page, id);
    router.push(`${pathname}${nextQs}`, { scroll: false });
  };

  const handleCloseProfile = useCallback(() => {
    const trigger = lastTriggerRef.current;
    if (pushedProfileRef.current) {
      pushedProfileRef.current = false;
      router.back();
    } else {
      const nextQs = buildQuery(appliedFilters, page, null);
      wroteQs.current = nextQs;
      router.replace(`${pathname}${nextQs}`, { scroll: false });
    }
    requestAnimationFrame(() => trigger?.focus());
  }, [appliedFilters, page, pathname, router]);

  const handleRefreshList = useCallback(async () => {
    await fetchList(page, 'replace');
  }, [fetchList, page]);

  return (
    <Page
      title={
        <span className="font-bold [&_.acc]:text-acc [&_.acc]:font-medium [.t-d_&_.acc]:text-acc">
          <strong>{total}</strong>{' '}
          <span className="acc">{total === 1 ? 'member' : 'members'}.</span>
        </span>
      }
      aside={
        canFully(s.roles, 'roles.assign') && (
          <button className="btn sm" onClick={() => setAdding(true)}>
            + Add member
          </button>
        )
      }
    >
      {adding && (
        <AddMemberModal onClose={() => setAdding(false)} onAdded={() => void handleRefreshList()} />
      )}
      <MemberFilters
        value={filterState}
        skills={skillOptions}
        batches={batchOptions}
        hasActive={hasActiveFilters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {loading && (items?.length ?? 0) === 0 ? (
        <ul className="bento" aria-busy="true" aria-label="Loading members">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="panel box c4 members-skeleton">
              <div className="members-skeleton__bar w-[55%]" />
              <div className="members-skeleton__bar w-[80%]" />
              <div className="members-skeleton__bar w-[40%]" />
            </li>
          ))}
        </ul>
      ) : clubTotal === 0 ? (
        <div className="panel box members-empty">
          <p className="label">NO MEMBERS IN THE CLUB YET.</p>
          {isAdmin(s.roles) && (
            <Link href="/app/admin" className="btn sm">
              Invite members
            </Link>
          )}
        </div>
      ) : (items?.length ?? 0) === 0 ? (
        <div className="panel box members-empty">
          <p className="label">NO MEMBERS MATCH THESE FILTERS.</p>
          <button type="button" className="btn sm line" onClick={handleReset}>
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <ul className="bento" aria-label="Club members">
            {(items ?? []).map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onOpen={handleOpenProfile}
                onMutated={handleRefreshList}
                highlightQuery={qInput}
              />
            ))}
          </ul>

          {hasMore && (
            <div className="flex justify-center items-center gap-3 mt-7">
              <button
                type="button"
                className="btn sm line"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {urlProfile && (
        <ProfileModal
          userId={urlProfile}
          onClose={handleCloseProfile}
          onMutated={handleRefreshList}
        />
      )}
    </Page>
  );
}

// No Suspense boundary: see AlumniPage.tsx.
export default function MembersPage({ initial }: { initial: MembersInitial | null }) {
  return <MembersInner initial={initial} />;
}
