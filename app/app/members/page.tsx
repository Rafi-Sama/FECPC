"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Page } from "@/components/app/Shell";
import { useStore } from "@/components/app/Store";
import { MemberCard } from "@/components/app/members/MemberCard";
import { MemberFilters, type MemberFilterState, type MemberTypeFilter } from "@/components/app/members/MemberFilters";
import { ProfileModal } from "@/components/app/members/ProfileModal";
import { isAdmin } from "@/lib/permissions";
import type { MemberSummary } from "@/lib/state";

const PAGE_SIZE = 16;

function parseType(raw: string | null): MemberTypeFilter {
  if (raw === "current" || raw === "alumni") return raw;
  return "all";
}

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function buildQuery(filters: MemberFilterState, page: number, profileId: string | null): string {
  const sp = new URLSearchParams();
  if (filters.q.trim()) sp.set("q", filters.q.trim());
  if (filters.rating) sp.set("rating", filters.rating);
  if (filters.skill) sp.set("skill", filters.skill);
  if (filters.batch) sp.set("batch", filters.batch);
  if (filters.type !== "all") sp.set("type", filters.type);
  if (page > 0) sp.set("page", String(page));
  if (profileId) sp.set("profile", profileId);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function MembersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { s, members: storeMembers } = useStore();

  // Initial URL state
  const urlQ = searchParams.get("q") ?? "";
  const urlRating = searchParams.get("rating") ?? "";
  const urlSkill = searchParams.get("skill") ?? "";
  const urlBatch = searchParams.get("batch") ?? "";
  const urlType = parseType(searchParams.get("type"));
  const urlPage = parsePage(searchParams.get("page"));
  const urlProfile = searchParams.get("profile");

  const [qInput, setQInput] = useState(urlQ);
  const [debouncedQ, setDebouncedQ] = useState(urlQ);
  const [rating, setRating] = useState(urlRating);
  const [skill, setSkill] = useState(urlSkill);
  const [batch, setBatch] = useState(urlBatch);
  const [type, setType] = useState<MemberTypeFilter>(urlType);
  const [page, setPage] = useState(urlPage);

  const [items, setItems] = useState<MemberSummary[]>([]);
  const [total, setTotal] = useState<number>(storeMembers.length);
  const [clubTotal, setClubTotal] = useState<number>(storeMembers.length);
  const [hasMore, setHasMore] = useState(false);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [batchOptions, setBatchOptions] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const reqSeq = useRef(0);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const pushedProfileRef = useRef(false);
  const restoredScrollRef = useRef(false);

  // Sync local filter controls if URL changes via browser Back/Forward
  useEffect(() => {
    setQInput(urlQ);
    setDebouncedQ(urlQ);
    setRating(urlRating);
    setSkill(urlSkill);
    setBatch(urlBatch);
    setType(urlType);
    setPage(urlPage);
  }, [urlQ, urlRating, urlSkill, urlBatch, urlType, urlPage]);

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
    () => ({ q: qInput, rating, skill, batch, type }),
    [qInput, rating, skill, batch, type]
  );

  const appliedFilters: MemberFilterState = useMemo(
    () => ({ q: debouncedQ, rating, skill, batch, type }),
    [debouncedQ, rating, skill, batch, type]
  );

  const hasActiveFilters = Boolean(debouncedQ || rating || skill || batch || type !== "all");

  // Persist filters & page in URL query string without wiping active ?profile=
  useEffect(() => {
    const nextQs = buildQuery(appliedFilters, page, urlProfile);
    const curQs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    if (nextQs !== curQs) {
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  // Fetch members for current filters (and restore up to `page` pages on mount/back)
  const fetchList = useCallback(
    async (targetPage: number, mode: "replace" | "append") => {
      const seq = ++reqSeq.current;
      if (mode === "append") setLoadingMore(true);
      else setLoading(true);

      try {
        // When replacing with page > 0 (e.g. Back navigation to ?page=2), load pages 0..targetPage in one slice
        const reqPage = mode === "append" ? targetPage : 0;
        const reqPageSize = mode === "append" ? PAGE_SIZE : (targetPage + 1) * PAGE_SIZE;

        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "listMembers",
            q: appliedFilters.q || undefined,
            rating: appliedFilters.rating || undefined,
            skill: appliedFilters.skill || undefined,
            batch: appliedFilters.batch ? Number(appliedFilters.batch) : undefined,
            type: appliedFilters.type,
            page: reqPage,
            pageSize: reqPageSize,
          }),
        });
        if (!res.ok || seq !== reqSeq.current) return;
        const data = (await res.json()) as {
          members: MemberSummary[];
          total: number;
          clubTotal: number;
          hasMore: boolean;
          skills: string[];
          batches: number[];
        };

        setItems((prev) => {
          if (mode === "replace") return data.members;
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...data.members.filter((m) => !seen.has(m.id))];
        });
        setTotal(data.total);
        setClubTotal(data.clubTotal);
        setHasMore(data.hasMore);
        setSkillOptions(data.skills);
        setBatchOptions(data.batches);

        if (mode === "replace" && !restoredScrollRef.current) {
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
    [appliedFilters, scrollKey]
  );

  // Trigger fetch whenever applied filters change
  useEffect(() => {
    void fetchList(page, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters.q, appliedFilters.rating, appliedFilters.skill, appliedFilters.batch, appliedFilters.type]);

  const handleFilterChange = (patch: Partial<MemberFilterState>) => {
    if ("q" in patch) {
      setQInput(patch.q ?? "");
      return;
    }
    if ("rating" in patch) setRating(patch.rating ?? "");
    if ("skill" in patch) setSkill(patch.skill ?? "");
    if ("batch" in patch) setBatch(patch.batch ?? "");
    if ("type" in patch && patch.type) setType(patch.type);
    setPage(0);
  };

  const handleReset = () => {
    setQInput("");
    setDebouncedQ("");
    setRating("");
    setSkill("");
    setBatch("");
    setType("all");
    setPage(0);
    router.replace(pathname, { scroll: false });
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchList(nextPage, "append");
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
      router.replace(`${pathname}${nextQs}`, { scroll: false });
    }
    requestAnimationFrame(() => trigger?.focus());
  }, [appliedFilters, page, pathname, router]);

  const handleRefreshList = useCallback(async () => {
    await fetchList(page, "replace");
  }, [fetchList, page]);

  return (
    <Page
      title={
        <span className="members-head-title">
          <strong>{total}</strong> <span className="acc">members.</span>
        </span>
      }
    >
      <MemberFilters
        value={filterState}
        skills={skillOptions}
        batches={batchOptions}
        hasActive={hasActiveFilters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {loading && items.length === 0 ? (
        <ul className="bento" aria-busy="true" aria-label="Loading members">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="panel box c4 members-skeleton">
              <div className="members-skeleton__bar" style={{ width: "55%" }} />
              <div className="members-skeleton__bar" style={{ width: "80%" }} />
              <div className="members-skeleton__bar" style={{ width: "40%" }} />
            </li>
          ))}
        </ul>
      ) : clubTotal === 0 ? (
        <div className="panel box members-empty">
          <p className="label">NO MEMBERS IN THE CLUB YET.</p>
          {isAdmin(s.role) && (
            <Link href="/app/admin" className="btn sm">
              Invite members
            </Link>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="panel box members-empty">
          <p className="label">NO MEMBERS MATCH THESE FILTERS.</p>
          <button type="button" className="btn sm line" onClick={handleReset}>
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <ul className="bento" aria-label="Club members">
            {items.map((member) => (
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
            <div className="members-pager">
              <button
                type="button"
                className="btn sm line"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
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

export default function MembersPage() {
  return (
    <Suspense>
      <MembersInner />
    </Suspense>
  );
}
