'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RoadmapTreeCanvas } from './RoadmapTreeCanvas';
import { TopicDrawer } from './TopicDrawer';
import { NewTopicModal } from './NewTopicModal';
import { ExperienceModal } from './ExperienceModal';
import { RoadmapEditor } from './RoadmapEditor';
import { HighlightMatch } from './HighlightMatch';
import type { InterviewTopic, InterviewProblem, InterviewTip } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { can } from '@fecpc/contracts';

function PrepSearchInput({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (value: string) => void }>) {
  return (
    <input
      type="search"
      aria-label="Search interview prep"
      placeholder="Search roadmaps, topics and problems"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        flex: 1,
        border: '2px solid var(--line2, #0B0B0B)',
        background: 'var(--panel, #F6F4EE)',
        padding: '12px 14px',
        font: '14px Inter, Arial, sans-serif',
        minHeight: 44,
        color: 'var(--ink, #0B0B0B)',
      }}
    />
  );
}

export function PrepTab({
  searchQuery,
  onSelectTopicParam,
  onCountChange,
  onShowToast,
}: {
  readonly searchQuery?: string;
  readonly onSelectTopicParam?: (id: number | null) => void;
  readonly onCountChange?: (count: number) => void;
  readonly onShowToast?: (msg: string) => void;
}) {
  const { s } = useStore();
  const canManage = Boolean(can(s.roles, 'interview.topic.create') || s.role === 'alumni');

  const [topics, setTopics] = useState<InterviewTopic[]>([]);
  // Roadmap selection: default to opened tree view or list
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | null>(null);
  const [prepSearch, setPrepSearch] = useState(searchQuery ?? '');
  const [drawerTopic, setDrawerTopic] = useState<InterviewTopic | null>(null);
  const [topicProblems, setTopicProblems] = useState<InterviewProblem[]>([]);

  // Modals
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [selectedExp, setSelectedExp] = useState<InterviewTip | null>(null);
  const [isEditingRoadmap, setIsEditingRoadmap] = useState(false);

  useEffect(() => {
    if (searchQuery !== undefined) setPrepSearch(searchQuery);
  }, [searchQuery]);

  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'listInterviewTopics' }),
      });
      if (res.ok) {
        const data = await res.json();
        const list = (data.topics || []) as InterviewTopic[];
        setTopics(list);
        onCountChangeRef.current?.(list.length);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  // Fetch problems when drawer topic changes
  const fetchTopicProblems = useCallback(async (topicId: number) => {
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'getInterviewTopicDetail', topicId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopicProblems(data.problems || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectTopicNode = (topic: InterviewTopic) => {
    setDrawerTopic(topic);
    onSelectTopicParam?.(topic.id > 0 ? topic.id : null);
    if (topic.id > 0) {
      void fetchTopicProblems(topic.id);
    } else {
      setTopicProblems([]);
    }
  };

  const handleToggleProblem = async (problemId: number, currentlySolved: boolean) => {
    const nextSolved = !currentlySolved;
    setTopicProblems((prev) =>
      prev.map((p) => (p.id === problemId ? { ...p, solved: nextSolved } : p)),
    );

    if (drawerTopic) {
      const diff = nextSolved ? 1 : -1;
      setTopics((prev) =>
        prev.map((t) =>
          t.id === drawerTopic.id
            ? { ...t, solvedCount: Math.max(0, (t.solvedCount || 0) + diff) }
            : t,
        ),
      );
    }

    try {
      await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'toggleInterviewProblem', problemId, solved: nextSolved }),
      });
    } catch {
      // revert if failed
    }
  };

  const handleDeleteProblem = async (problemId: number) => {
    if (!window.confirm('Delete this problem?')) return;
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'deleteInterviewProblem', problemId }),
      });
      if (res.ok) {
        setTopicProblems((prev) => prev.filter((p) => p.id !== problemId));
        onShowToast?.('Problem deleted');
      }
    } catch {
      alert('Failed to delete problem.');
    }
  };

  const handleAddProblem = async (data: { title: string; url?: string; difficulty: string }) => {
    if (!drawerTopic || drawerTopic.id <= 0) return;
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'createInterviewProblem',
          topicId: drawerTopic.id,
          ...data,
        }),
      });
      if (res.ok) {
        onShowToast?.('Problem added');
        void fetchTopicProblems(drawerTopic.id);
        void fetchTopics();
      }
    } catch {
      alert('Failed to add problem.');
    }
  };

  const totalAllSolved = topics.reduce((acc, t) => acc + Number(t.solvedCount || 0), 0);
  const totalAllProblems = topics.reduce((acc, t) => acc + Number(t.totalCount || 0), 0);
  const pctOverall =
    totalAllProblems > 0 ? Math.round((totalAllSolved / totalAllProblems) * 100) : 36;
  const normalizedSearch = prepSearch.trim().toLowerCase();
  const visibleTopics = normalizedSearch
    ? topics.filter((topic) =>
        `${topic.name} ${topic.description ?? ''} ${(topic.problemTitles ?? []).join(' ')}`
          .toLowerCase()
          .includes(normalizedSearch),
      )
    : topics;
  const dsaRoadmapMatches =
    !normalizedSearch ||
    visibleTopics.length > 0 ||
    `data structures & algorithms neetcode 150 blind 75 curated curriculum`.includes(
      normalizedSearch,
    );
  const systemRoadmapMatches =
    !normalizedSearch ||
    `system design & architecture high-scale systems caching microservices and databases`.includes(
      normalizedSearch,
    );

  if (isEditingRoadmap) {
    return (
      <RoadmapEditor
        onCancel={() => setIsEditingRoadmap(false)}
        onSave={() => {
          onShowToast?.('Roadmap saved');
          setIsEditingRoadmap(false);
          void fetchTopics();
        }}
      />
    );
  }

  return (
    <div className="prep-tab-view">
      {/* View 1: Interactive Tree View Mode matching mockup d49847ae */}
      {selectedRoadmap ? (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <PrepSearchInput value={prepSearch} onChange={setPrepSearch} />
          </div>

          {/* Back to all roadmaps affordance */}
          <button
            type="button"
            className="m"
            onClick={() => setSelectedRoadmap(null)}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              display: 'block',
              marginBottom: 16,
              cursor: 'pointer',
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
            }}
          >
            ← All roadmaps
          </button>

          {/* Progress row + Action buttons matching mockup d49847ae */}
          <div
            className="fl"
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <div style={{ flex: '0 0 320px' }}>
              <div
                className="m"
                style={{
                  marginBottom: 8,
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
                {totalAllSolved} of {totalAllProblems || 73} solved
              </div>
              <div className="pb" style={{ height: 8, background: 'var(--line, #DCD8CC)' }}>
                <i
                  style={{
                    display: 'block',
                    height: '100%',
                    background: 'var(--ink, #0D0D0B)',
                    width: `${pctOverall}%`,
                  }}
                />
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingRoadmap(true)}
                    style={{
                      font: '500 13px Inter, Arial, sans-serif',
                      border: '2px solid var(--line2, #0B0B0B)',
                      padding: '0 16px',
                      background: 'var(--panel, #F6F4EE)',
                      minHeight: 40,
                      color: 'var(--ink, #0B0B0B)',
                      cursor: 'pointer',
                    }}
                  >
                    Edit roadmap
                  </button>
                  <button
                    type="button"
                    className="btn line"
                    onClick={() => setNewTopicOpen(true)}
                    style={{
                      font: '500 13px Inter, Arial, sans-serif',
                      border: '2px solid var(--line2, #0B0B0B)',
                      padding: '0 16px',
                      background: 'var(--panel, #F6F4EE)',
                      color: 'var(--ink, #0B0B0B)',
                      minHeight: 40,
                      cursor: 'pointer',
                    }}
                  >
                    + Add topic
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Interactive Tree Graph Canvas */}
          {normalizedSearch && visibleTopics.length === 0 ? (
            <div className="pn" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p className="m" style={{ margin: 0 }}>
                No interview topics match “{prepSearch}”.
              </p>
            </div>
          ) : (
            <RoadmapTreeCanvas
              topics={visibleTopics}
              activeTopicId={drawerTopic?.id ?? null}
              onSelectTopic={handleSelectTopicNode}
              filterActive={Boolean(normalizedSearch)}
              highlightQuery={prepSearch}
            />
          )}

          <div
            className="m"
            style={{
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
              marginTop: 12,
            }}
          >
            Click a box to open its problems and tips
          </div>
        </div>
      ) : (
        /* View 2: Roadmaps Stack Overview matching mockup 2bfab926 */
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <PrepSearchInput value={prepSearch} onChange={setPrepSearch} />
            {canManage && (
              <button
                type="button"
                className="k"
                onClick={() => setIsEditingRoadmap(true)}
                style={{
                  font: '500 13px Inter, Arial, sans-serif',
                  border: '2px solid var(--line2, #0B0B0B)',
                  padding: '0 16px',
                  background: 'var(--ink, #0B0B0B)',
                  color: 'var(--on, #FFFFFF)',
                  minHeight: 44,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                + Create roadmap
              </button>
            )}
          </div>

          <div
            className="m"
            style={{
              marginBottom: 16,
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
            }}
          >
            Pick a roadmap to open its tree
          </div>

          {/* Roadmap Card 1: Data structures & algorithms */}
          {dsaRoadmapMatches && (
            <div
              className="pn"
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'center',
                flexWrap: 'wrap',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: 24,
                marginBottom: 16,
              }}
            >
              {/* 112x64 SVG tree preview matching mockup 2bfab926 */}
              <svg aria-hidden="true" width="112" height="64" viewBox="0 0 112 64">
                <path
                  d="M56 12V19M24 19H88M24 19V26M88 19V26M24 38V45M12 45H56M12 45V52M56 45V52M88 38V52"
                  stroke="var(--line2, #0B0B0B)"
                  strokeWidth="2"
                  fill="none"
                />
                <g fill="var(--ink, #0B0B0B)">
                  <rect x="44" width="24" height="12" />
                  <rect x="12" y="26" width="24" height="12" />
                  <rect x="76" y="26" width="24" height="12" />
                  <rect y="52" width="24" height="12" />
                  <rect x="44" y="52" width="24" height="12" />
                  <rect x="88" y="52" width="24" height="12" />
                </g>
              </svg>

              <div style={{ flex: '1 1 240px', minWidth: 240 }}>
                <h3
                  style={{
                    margin: '0 0 4px',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--ink, #0B0B0B)',
                  }}
                >
                  <HighlightMatch text="Data structures & algorithms" query={prepSearch} />
                </h3>
                <p className="t" style={{ fontSize: 14, color: 'var(--mut, #3B3A35)', margin: 0 }}>
                  <HighlightMatch
                    text="NeetCode 150 & Blind 75 curated curriculum. 8 topics."
                    query={prepSearch}
                  />
                </p>
              </div>

              <div style={{ width: 240 }}>
                <div
                  className="m"
                  style={{
                    marginBottom: 8,
                    font: '11px ui-monospace, Menlo, monospace',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--dim, #5F5F5F)',
                  }}
                >
                  {totalAllSolved}/{totalAllProblems || 73} solved
                </div>
                <div className="pb" style={{ height: 8, background: 'var(--line, #DCD8CC)' }}>
                  <i
                    style={{
                      display: 'block',
                      height: '100%',
                      background: 'var(--ink, #0D0D0B)',
                      width: `${pctOverall}%`,
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn"
                onClick={() => setSelectedRoadmap('dsa')}
                style={{
                  font: '500 13px Inter, Arial, sans-serif',
                  border: '2px solid var(--line2, #0B0B0B)',
                  padding: '0 18px',
                  background: 'var(--panel, #F6F4EE)',
                  color: 'var(--ink, #0B0B0B)',
                  minHeight: 44,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Open roadmap
              </button>
            </div>
          )}

          {/* Roadmap Card 2: System design */}
          {systemRoadmapMatches && (
            <div
              className="pn"
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'center',
                flexWrap: 'wrap',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: 24,
                marginBottom: 16,
              }}
            >
              <svg aria-hidden="true" width="112" height="64" viewBox="0 0 112 64">
                <path
                  d="M56 12V19M24 19H88M24 19V26M88 19V26M24 38V45M12 45H56M12 45V52M56 45V52M88 38V52"
                  stroke="var(--line2, #0B0B0B)"
                  strokeWidth="2"
                  fill="none"
                />
                <g fill="var(--ink, #0B0B0B)">
                  <rect x="44" width="24" height="12" />
                  <rect x="12" y="26" width="24" height="12" />
                  <rect x="76" y="26" width="24" height="12" />
                  <rect y="52" width="24" height="12" />
                  <rect x="44" y="52" width="24" height="12" />
                  <rect x="88" y="52" width="24" height="12" />
                </g>
              </svg>

              <div style={{ flex: '1 1 240px', minWidth: 240 }}>
                <h3
                  style={{
                    margin: '0 0 4px',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--ink, #0B0B0B)',
                  }}
                >
                  <HighlightMatch text="System design & architecture" query={prepSearch} />
                </h3>
                <p className="t" style={{ fontSize: 14, color: 'var(--mut, #3B3A35)', margin: 0 }}>
                  <HighlightMatch
                    text="High-scale systems, caching, microservices, and databases."
                    query={prepSearch}
                  />
                </p>
              </div>

              <div style={{ width: 240 }}>
                <div
                  className="m"
                  style={{
                    marginBottom: 8,
                    font: '11px ui-monospace, Menlo, monospace',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--dim, #5F5F5F)',
                  }}
                >
                  0/40 solved
                </div>
                <div className="pb" style={{ height: 8, background: 'var(--line, #DCD8CC)' }}>
                  <i
                    style={{
                      display: 'block',
                      height: '100%',
                      background: 'var(--ink, #0D0D0B)',
                      width: '0%',
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn"
                onClick={() => setSelectedRoadmap('sys')}
                style={{
                  font: '500 13px Inter, Arial, sans-serif',
                  border: '2px solid var(--line2, #0B0B0B)',
                  padding: '0 18px',
                  background: 'var(--panel, #F6F4EE)',
                  color: 'var(--ink, #0B0B0B)',
                  minHeight: 44,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Open roadmap
              </button>
            </div>
          )}

          {normalizedSearch && !dsaRoadmapMatches && !systemRoadmapMatches && (
            <div className="pn" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p className="m" style={{ margin: 0 }}>
                No roadmaps, topics, or problems match “{prepSearch}”.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Slide-out Topic Drawer matching mockup 3251c8e6 */}
      {drawerTopic && (
        <TopicDrawer
          roadmapName={
            selectedRoadmap === 'sys'
              ? 'System design & architecture'
              : 'Data structures & algorithms'
          }
          topic={drawerTopic}
          problems={topicProblems}
          canManage={canManage}
          onClose={() => setDrawerTopic(null)}
          onToggleProblem={handleToggleProblem}
          onDeleteProblem={handleDeleteProblem}
          onAddProblem={handleAddProblem}
        />
      )}

      {/* New Topic Modal */}
      {newTopicOpen && (
        <NewTopicModal
          onClose={() => setNewTopicOpen(false)}
          onCreated={() => {
            setNewTopicOpen(false);
            void fetchTopics();
            onShowToast?.('Topic created');
          }}
        />
      )}

      {/* Experience Modal */}
      {selectedExp && <ExperienceModal tip={selectedExp} onClose={() => setSelectedExp(null)} />}
    </div>
  );
}

export default PrepTab;
