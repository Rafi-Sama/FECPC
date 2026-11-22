'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RoadmapTreeCanvas } from './RoadmapTreeCanvas';
import { TopicDrawer } from './TopicDrawer';
import { RoadmapEditor, type RoadmapProblem } from './RoadmapEditor';
import { HighlightMatch } from './HighlightMatch';
import type {
  InterviewProblem,
  InterviewRoadmap,
  InterviewTopic,
  RoadmapKind,
} from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { canFully } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const mono = {
  font: '14px ui-monospace, Menlo, monospace',
  color: 'var(--dim, #5F5F5F)',
} as const;
const btn = {
  font: '500 14px Inter, Arial, sans-serif',
  border: '2px solid var(--line2, #0B0B0B)',
  padding: '0 16px',
  background: 'var(--panel, #F6F4EE)',
  color: 'var(--ink, #0B0B0B)',
  minHeight: 44,
  cursor: 'pointer',
} as const;

async function query<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch('/api/alumni', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function Progress({ solved, total }: Readonly<{ solved: number; total: number }>) {
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  return (
    <div style={{ width: 240 }}>
      <div className="m" style={{ ...mono, marginBottom: 8 }}>
        {solved}/{total} solved
      </div>
      <div className="pb" style={{ height: 8, background: 'var(--line, #DCD8CC)' }}>
        <i
          style={{
            display: 'block',
            height: '100%',
            background: 'var(--ink, #0D0D0B)',
            width: `${pct}%`,
          }}
        />
      </div>
    </div>
  );
}

function PrepSearchInput({
  value,
  onChange,
  label = 'Search interview prep',
  placeholder = 'Search roadmaps, topics and problems',
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}>) {
  return (
    <input
      type="search"
      aria-label={label}
      placeholder={placeholder}
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

/** Interview prep: many roadmaps. `kind="learn"`: the club's one learning roadmap, opened directly. */
export function PrepTab({
  searchQuery,
  onSelectTopicParam,
  onCountChange,
  onShowToast,
  kind = 'prep',
}: {
  readonly kind?: RoadmapKind;
  readonly searchQuery?: string;
  readonly onSelectTopicParam?: (id: number | null) => void;
  readonly onCountChange?: (count: number) => void;
  readonly onShowToast?: (msg: string) => void;
}) {
  const sure = useConfirm();
  const { s } = useStore();
  // Page gates are cosmetic; the API checks both capabilities again.
  const canManageRoadmaps = canFully(s.roles, 'interview.roadmap.manage');
  const canManageProblems = canFully(s.roles, 'interview.problem.create');

  const [roadmaps, setRoadmaps] = useState<InterviewRoadmap[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [topics, setTopics] = useState<InterviewTopic[]>([]);
  // Which roadmap `topics` belongs to; editing waits for it so a save never starts from an empty tree.
  const [topicsFor, setTopicsFor] = useState<number | null>(null);
  // undefined = not editing, null = creating a new roadmap.
  const [editing, setEditing] = useState<InterviewRoadmap | null | undefined>(undefined);
  const [editProblems, setEditProblems] = useState<RoadmapProblem[]>([]);
  const [opening, setOpening] = useState(false);
  // The editor starts from the full roadmap (problems included), so it opens only once they load.
  const openEditor = async (r: InterviewRoadmap) => {
    setOpening(true);
    const data = await query<{ problems: RoadmapProblem[] }>({
      action: 'listInterviewProblems',
      roadmapId: r.id,
    });
    setOpening(false);
    if (!data) return onShowToast?.('Could not load the roadmap’s problems. Try again.');
    setEditProblems(data.problems);
    setEditing(r);
  };
  const [prepSearch, setPrepSearch] = useState(searchQuery ?? '');
  const [loaded, setLoaded] = useState(false);
  const learn = kind === 'learn';
  const search = (
    <PrepSearchInput
      value={prepSearch}
      onChange={setPrepSearch}
      {...(learn && { label: 'Search the roadmap', placeholder: 'Search topics and problems' })}
    />
  );
  const [drawerTopic, setDrawerTopic] = useState<InterviewTopic | null>(null);
  const [topicProblems, setTopicProblems] = useState<InterviewProblem[]>([]);

  useEffect(() => {
    if (searchQuery !== undefined) setPrepSearch(searchQuery);
  }, [searchQuery]);

  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const fetchRoadmaps = useCallback(async () => {
    const data = await query<{ roadmaps: InterviewRoadmap[] }>({
      action: 'listInterviewRoadmaps',
      kind,
    });
    if (!data) return;
    setRoadmaps(data.roadmaps);
    if (kind === 'learn') setOpenId(data.roadmaps[0]?.id ?? null);
    setLoaded(true);
    onCountChangeRef.current?.(data.roadmaps.reduce((n, r) => n + r.topicCount, 0));
  }, [kind]);

  const fetchTopics = useCallback(async (roadmapId: number) => {
    const data = await query<{ topics: InterviewTopic[] }>({
      action: 'listInterviewTopics',
      roadmapId,
    });
    if (data) {
      setTopics(data.topics);
      setTopicsFor(roadmapId);
    }
  }, []);

  useEffect(() => {
    void fetchRoadmaps();
  }, [fetchRoadmaps]);

  useEffect(() => {
    setTopics([]);
    setTopicsFor(null);
    if (openId !== null) void fetchTopics(openId);
  }, [openId, fetchTopics]);

  const fetchTopicProblems = useCallback(async (topicId: number) => {
    const data = await query<{ problems: InterviewProblem[] }>({
      action: 'getInterviewTopicDetail',
      topicId,
    });
    if (data) setTopicProblems(data.problems);
  }, []);

  const refresh = () => {
    void fetchRoadmaps();
    if (openId !== null) void fetchTopics(openId);
  };

  const handleSelectTopicNode = (topic: InterviewTopic) => {
    setDrawerTopic(topic);
    onSelectTopicParam?.(topic.id);
    setTopicProblems([]);
    void fetchTopicProblems(topic.id);
  };

  const handleToggleProblem = async (problemId: number, currentlySolved: boolean) => {
    const diff = currentlySolved ? -1 : 1;
    setTopicProblems((prev) =>
      prev.map((p) => (p.id === problemId ? { ...p, solved: !currentlySolved } : p)),
    );
    if (drawerTopic)
      setTopics((prev) =>
        prev.map((t) =>
          t.id === drawerTopic.id ? { ...t, solvedCount: Math.max(0, t.solvedCount + diff) } : t,
        ),
      );
    if (!(await query({ action: 'toggleInterviewProblem', problemId }))) refresh();
    else void fetchRoadmaps();
  };

  const handleDeleteProblem = async (problemId: number) => {
    if (!(await sure('Delete this problem?'))) return;
    if (await query({ action: 'deleteInterviewProblem', problemId })) {
      setTopicProblems((prev) => prev.filter((p) => p.id !== problemId));
      onShowToast?.('Problem deleted');
      refresh();
    } else onShowToast?.('Could not delete the problem.');
  };

  const handleAddProblem = async (data: { title: string; url: string; difficulty: string }) => {
    if (!drawerTopic) return false;
    const res = await fetch('/api/alumni', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'createInterviewProblem', topicId: drawerTopic.id, ...data }),
    }).catch(() => null);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null);
      onShowToast?.(j?.error ?? 'You seem to be offline. The problem was not added.');
      return false;
    }
    onShowToast?.('Problem added');
    void fetchTopicProblems(drawerTopic.id);
    refresh();
    return true;
  };

  const open = roadmaps.find((r) => r.id === openId) ?? null;
  const needle = prepSearch.trim().toLowerCase();
  const visibleTopics = needle
    ? topics.filter((t) =>
        `${t.name} ${t.description ?? ''} ${(t.problemTitles ?? []).join(' ')}`
          .toLowerCase()
          .includes(needle),
      )
    : topics;
  const visibleRoadmaps = needle
    ? roadmaps.filter((r) =>
        `${r.name} ${r.description ?? ''} ${r.topicNames.join(' ')}`.toLowerCase().includes(needle),
      )
    : roadmaps;

  if (editing !== undefined) {
    return (
      <RoadmapEditor
        kind={kind}
        roadmap={editing}
        topics={editing ? topics : []}
        problems={editing ? editProblems : []}
        onCancel={() => setEditing(undefined)}
        onSaved={(id) => {
          onShowToast?.('Roadmap saved');
          setEditing(undefined);
          void fetchRoadmaps();
          if (id === openId) void fetchTopics(id);
          else setOpenId(id);
        }}
        onDeleted={() => {
          onShowToast?.('Roadmap deleted');
          setEditing(undefined);
          setOpenId(null);
          void fetchRoadmaps();
        }}
      />
    );
  }

  return (
    <div className="prep-tab-view">
      {open ? (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>{search}</div>
          {!learn && (
            <button
              type="button"
              className="m"
              onClick={() => {
                setOpenId(null);
                setDrawerTopic(null);
              }}
              style={{ ...mono, background: 'none', border: 0, padding: 0, marginBottom: 16 }}
            >
              ← All roadmaps
            </button>
          )}
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22, flex: '1 1 auto' }}>{open.name}</h2>
            <Progress solved={open.solvedCount} total={open.totalCount} />
            {canManageRoadmaps && (
              <button
                type="button"
                onClick={() => void openEditor(open)}
                disabled={topicsFor !== open.id || opening}
                style={btn}
              >
                {opening ? 'Opening…' : 'Edit roadmap'}
              </button>
            )}
          </div>

          {visibleTopics.length === 0 ? (
            <div className="pn" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p className="m" style={{ margin: 0 }}>
                {topicsFor !== open.id
                  ? 'Loading…'
                  : needle
                    ? `No topics match “${prepSearch}”.`
                    : 'No topics yet.'}
              </p>
            </div>
          ) : (
            <RoadmapTreeCanvas
              horizontal={learn}
              topics={visibleTopics}
              activeTopicId={drawerTopic?.id ?? null}
              onSelectTopic={handleSelectTopicNode}
              highlightQuery={prepSearch}
            />
          )}
        </div>
      ) : learn ? (
        <div className="pn" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p className="m" style={{ margin: '0 0 16px' }}>
            {!loaded ? 'Loading…' : 'No roadmap yet.'}
          </p>
          {loaded && canManageRoadmaps && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              style={{ ...btn, background: 'var(--ink, #0B0B0B)', color: 'var(--on, #FFFFFF)' }}
            >
              + Create the roadmap
            </button>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            {search}
            {canManageRoadmaps && (
              <button
                type="button"
                onClick={() => setEditing(null)}
                style={{
                  ...btn,
                  background: 'var(--ink, #0B0B0B)',
                  color: 'var(--on, #FFFFFF)',
                  whiteSpace: 'nowrap',
                }}
              >
                + Create roadmap
              </button>
            )}
          </div>

          {visibleRoadmaps.map((r) => (
            <div
              key={r.id}
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
              <div style={{ flex: '1 1 240px', minWidth: 240 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
                  <HighlightMatch text={r.name} query={prepSearch} />
                </h3>
                <p className="t" style={{ fontSize: 14, color: 'var(--mut, #3B3A35)', margin: 0 }}>
                  <HighlightMatch
                    text={`${r.description ? `${r.description} ` : ''}${r.topicCount} topics.`}
                    query={prepSearch}
                  />
                </p>
              </div>
              <Progress solved={r.solvedCount} total={r.totalCount} />
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                style={{ ...btn, fontWeight: 600 }}
              >
                Open roadmap
              </button>
            </div>
          ))}

          {visibleRoadmaps.length === 0 && (
            <div className="pn" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p className="m" style={{ margin: 0 }}>
                {needle ? `No roadmaps match “${prepSearch}”.` : 'No roadmaps yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {drawerTopic && open && (
        <TopicDrawer
          roadmapName={open.name}
          topic={drawerTopic}
          problems={topicProblems}
          canManage={canManageProblems}
          onClose={() => setDrawerTopic(null)}
          onToggleProblem={handleToggleProblem}
          onDeleteProblem={handleDeleteProblem}
          onAddProblem={handleAddProblem}
        />
      )}
    </div>
  );
}

export default PrepTab;
