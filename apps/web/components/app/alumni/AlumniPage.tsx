'use client';
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { AlumniTab } from './AlumniTab';
import { JobsTab } from './JobsTab';
import { BlogsTab } from './BlogsTab';
import { AlumniProfileModal } from './AlumniProfileModal';

export type AlumniSubTab = 'alumni' | 'jobs' | 'blogs';

const SUB_TABS: { key: AlumniSubTab; label: string }[] = [
  { key: 'alumni', label: 'Alumni' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'blogs', label: 'Blogs' },
];

function parseSubTab(param: string | null): AlumniSubTab {
  if (!param) return 'alumni';
  const lower = param.toLowerCase();
  if (lower === 'jobs') return 'jobs';
  if (lower === 'blogs' || lower === 'blog') return 'blogs';
  return 'alumni';
}

function AlumniPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { counts } = useStore();

  const [activeTab, setActiveTab] = useState<AlumniSubTab>(() =>
    parseSubTab(searchParams.get('tab')),
  );

  // Tab-specific counts
  const [tabCounts, setTabCounts] = useState<{
    alumni: number;
    jobs: number;
    blogs: number;
  }>({
    alumni: counts.alumniCount ?? 0,
    jobs: counts.jobsCount ?? 0,
    blogs: counts.blogsCount ?? 0,
  });

  const handleAlumniCountChange = useCallback((cnt: number) => {
    setTabCounts((prev) => (prev.alumni === cnt ? prev : { ...prev, alumni: cnt }));
  }, []);

  const handleJobsCountChange = useCallback((cnt: number) => {
    setTabCounts((prev) => (prev.jobs === cnt ? prev : { ...prev, jobs: cnt }));
  }, []);

  const handleBlogsCountChange = useCallback((cnt: number) => {
    setTabCounts((prev) => (prev.blogs === cnt ? prev : { ...prev, blogs: cnt }));
  }, []);

  // Query params state
  const searchQuery = searchParams.get('q') || undefined;
  const activeJobId = searchParams.get('job') ? Number(searchParams.get('job')) : null;
  const activeReadSlug = searchParams.get('read') || null;
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => searchParams.get('profile') || null,
  );

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && /^(prep|interview|interview-prep)$/i.test(tabParam)) {
      router.replace('/app/prep');
      return;
    }
    if (tabParam) {
      setActiveTab(parseSubTab(tabParam));
    }
    const profParam = searchParams.get('profile');
    if (profParam) {
      setActiveProfileId(profParam);
    }
  }, [router, searchParams]);

  const updateUrlParam = useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleTabChange = (nextTab: AlumniSubTab) => {
    setActiveTab(nextTab);
    const sp = new URLSearchParams();
    sp.set('tab', nextTab);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  const handleOpenProfile = (id: string) => {
    setActiveProfileId(id);
    updateUrlParam('profile', id);
  };

  const handleCloseProfile = () => {
    setActiveProfileId(null);
    updateUrlParam('profile', null);
  };

  // Header copy matching the mockup {#} {suffix}. pattern
  let headerContent: ReactNode;
  if (activeTab === 'alumni') {
    const n = tabCounts.alumni;
    headerContent = (
      <>
        <strong>{n}</strong> {n === 1 ? 'alumnus' : 'alumni'}{' '}
        <span className="acc">open to questions.</span>
      </>
    );
  } else if (activeTab === 'jobs') {
    const n = tabCounts.jobs;
    headerContent = (
      <>
        <strong>{n}</strong> open <span className="acc">roles.</span>
      </>
    );
  } else {
    const n = tabCounts.blogs;
    headerContent = (
      <>
        <strong>{n}</strong> blog <span className="acc">posts.</span>
      </>
    );
  }

  return (
    <Page title={headerContent}>
      {/* Sub-tabs: ALUMNI · JOBS · BLOGS */}
      <div
        role="tablist"
        aria-label="Alumni sub-tabs"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        {SUB_TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              type="button"
              className={`tag tab ${isActive ? 'on' : ''}`}
              onClick={() => handleTabChange(t.key)}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '10px 16px',
                border: '2px solid var(--line2, #0B0B0B)',
                background: isActive ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                color: isActive ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active Sub-Tab View */}
      {activeTab === 'alumni' && (
        <AlumniTab
          searchQuery={searchQuery}
          onOpenProfile={handleOpenProfile}
          onCountChange={handleAlumniCountChange}
        />
      )}

      {activeTab === 'jobs' && (
        <JobsTab
          searchQuery={searchQuery}
          activeJobId={activeJobId}
          onSelectJob={(id) => updateUrlParam('job', id ? String(id) : null)}
          onCountChange={handleJobsCountChange}
          onShowToast={showToast}
        />
      )}

      {activeTab === 'blogs' && (
        <BlogsTab
          searchQuery={searchQuery}
          activeReadSlug={activeReadSlug}
          onSelectReadSlug={(slug) => updateUrlParam('read', slug)}
          onOpenProfile={handleOpenProfile}
          onCountChange={handleBlogsCountChange}
          onShowToast={showToast}
        />
      )}

      {/* Global Alumni Profile Modal */}
      {activeProfileId && (
        <AlumniProfileModal
          userId={activeProfileId}
          onClose={handleCloseProfile}
          onMutated={() => {}}
        />
      )}

      {/* Toast Notification Container */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'var(--ink, #0B0B0B)',
            color: 'var(--on, #ECE9E1)',
            borderLeft: '4px solid var(--acc, #1F3BFF)',
            padding: '12px 20px',
            boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.3)',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            zIndex: 10000,
            animation: 'slideIn 0.2s ease-out',
          }}
        >
          {toastMessage}
        </div>
      )}
    </Page>
  );
}

export function AlumniPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <AlumniPageInner />
    </Suspense>
  );
}

export default AlumniPage;
