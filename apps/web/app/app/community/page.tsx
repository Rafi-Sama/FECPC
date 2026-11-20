'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Suggest } from '@/components/app/community/Suggest';
import {
  AnnouncementModal,
  type UnifiedAnnouncement,
} from '@/components/app/announcements/AnnouncementModal';
import { MilestonesCard } from '@/components/app/feed/MilestonesCard';
import { feedCategoryChip, NewPostModal } from '@/components/app/feed/NewPostModal';
import { PostModal } from '@/components/app/feed/PostModal';
import { VoteWidget } from '@/components/app/feed/VoteWidget';
import { IdeaModal } from '@/components/app/ideas/IdeaModal';
import { ideaTypeLabel, NewIdeaModal } from '@/components/app/ideas/NewIdeaModal';
import { ProfileModal } from '@/components/app/members/ProfileModal';
import {
  excerptFromMarkdown,
  MarkdownEditor,
  relTime,
} from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';
import { AlumniPage } from '@/components/app/alumni/AlumniPage';
import { HighlightMatch } from '@/components/app/alumni/HighlightMatch';
import { announcements, polls } from '@fecpc/content/member-area';
import { groupsData } from '@fecpc/content/training';
import { can, isCommittee } from '@fecpc/contracts';
import type {
  FeedCategory,
  FeedPostSummary,
  IdeaStatus,
  IdeaSummary,
  IdeaType,
} from '@fecpc/contracts';

const tabs = ['Feed', 'Announcements', 'Ideas', 'Alumni', 'Polls', 'Groups', 'Suggest'] as const;
type Tab = (typeof tabs)[number];

const FEED_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'wins', label: 'Wins' },
  { key: 'help', label: 'Help' },
  { key: 'contests', label: 'Contests' },
] as const;

const IDEA_TYPE_FILTERS: { key: 'all' | IdeaType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'idea', label: 'Idea' },
  { key: 'teammate', label: 'Teammate' },
  { key: 'study', label: 'Study' },
];

const IDEA_STATUS_FILTERS: { key: 'all' | Exclude<IdeaStatus, 'closed'>; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'planned', label: 'Planned' },
  { key: 'shipped', label: 'Shipped' },
];

function parseTab(param: string | null): Tab {
  if (!param) return 'Feed';
  const lower = param.toLowerCase();
  if (lower === 'alumni' || lower === 'jobs' || lower === 'prep' || lower === 'blogs')
    return 'Alumni';
  return tabs.find((t) => t.toLowerCase() === lower) ?? 'Feed';
}

function CommunityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { s, me, act, counts, news, members, who } = useStore();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')));
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    searchParams.get('profile'),
  );
  const lastProfileTriggerRef = useRef<HTMLElement | null>(null);

  const handleTabChange = useCallback(
    (nextTab: Tab) => {
      if (nextTab === 'Alumni') {
        router.push('/app/community?tab=alumni');
        return;
      }
      setTab(nextTab);
      router.replace(`/app/community?tab=${nextTab.toLowerCase()}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    const p = searchParams.get('tab');
    if (p) setTab(parseTab(p));
    const prof = searchParams.get('profile');
    if (prof) setActiveProfileId(prof);
  }, [searchParams]);

  const handleOpenProfile = useCallback((userId: string, trigger?: HTMLElement | null) => {
    lastProfileTriggerRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    setActiveProfileId(userId);
  }, []);

  const handleCloseProfile = useCallback(() => {
    const trigger = lastProfileTriggerRef.current;
    setActiveProfileId(null);
    requestAnimationFrame(() => trigger?.focus());
  }, []);

  /* ────────── FEED STATE ────────── */
  const [feedQ, setFeedQ] = useState('');
  const [feedDebouncedQ, setFeedDebouncedQ] = useState('');
  const [feedCat, setFeedCat] = useState<(typeof FEED_FILTERS)[number]['key']>('all');
  const [feedItems, setFeedItems] = useState<FeedPostSummary[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedInitialized, setFeedInitialized] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const feedSentinelRef = useRef<HTMLDivElement>(null);
  const feedReqSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setFeedDebouncedQ(feedQ.trim()), 240);
    return () => clearTimeout(t);
  }, [feedQ]);

  const fetchFeed = useCallback(
    async (cursor: string | null, append: boolean) => {
      const seq = ++feedReqSeq.current;
      setFeedLoading(true);
      try {
        const res = await fetch('/api/community', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'listFeedPosts',
            q: feedDebouncedQ,
            category: feedCat,
            sort: 'new',
            cursor,
            limit: 20,
          }),
        });
        if (!res.ok || seq !== feedReqSeq.current) return;
        const data = (await res.json()) as { items: FeedPostSummary[]; nextCursor: string | null };
        setFeedItems((prev) => {
          if (!append) return data.items;
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...data.items.filter((x) => !seen.has(x.id))];
        });
        setFeedCursor(data.nextCursor);
        setFeedInitialized(true);
      } finally {
        if (seq === feedReqSeq.current) setFeedLoading(false);
      }
    },
    [feedDebouncedQ, feedCat],
  );

  useEffect(() => {
    if (tab !== 'Feed') return;
    fetchFeed(null, false);
  }, [tab, fetchFeed]);

  useEffect(() => {
    if (tab !== 'Feed' || !feedCursor || feedLoading) return;
    const el = feedSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchFeed(feedCursor, true);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, feedCursor, feedLoading, fetchFeed]);

  const visibleFeedItems = useMemo(() => {
    const needle = feedQ.trim().toLowerCase();
    if (!needle) return feedItems;
    return feedItems.filter(
      (p) => p.title.toLowerCase().includes(needle) || p.body_md.toLowerCase().includes(needle),
    );
  }, [feedItems, feedQ]);

  const handlePublishFeed = async (data: {
    title: string;
    body_md: string;
    category: FeedCategory;
  }) => {
    const ok = await act('createFeedPost', data);
    if (ok) {
      const optimistic: FeedPostSummary = {
        id: Date.now(),
        user_id: me.id,
        author_name: me.name,
        author_solved: me.problems_solved ?? me.solved,
        author_rating: me.rating,
        author_role: me.role ?? null,
        author_avatar: me.avatar_url ?? null,
        title: data.title,
        body_md: data.body_md,
        category: data.category,
        score: 0,
        my_vote: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setFeedItems((prev) => [optimistic, ...prev]);
      await fetchFeed(null, false);
    }
    return ok;
  };

  const handleVoteFeed = async (postId: number, value: 1 | -1) => {
    setFeedItems((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const next: -1 | 0 | 1 = p.my_vote === value ? 0 : value;
        return { ...p, my_vote: next, score: p.score + (next - p.my_vote) };
      }),
    );
    const ok = await act('voteFeed', { postId, value });
    if (!ok) await fetchFeed(null, false);
  };

  /* ────────── ANNOUNCEMENTS STATE ────────── */
  const [annFilter, setAnnFilter] = useState<'all' | 'unread' | 'must'>('all');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annAudience, setAnnAudience] = useState<'all' | 'mentees'>('all');
  const [annPinned, setAnnPinned] = useState(false);
  const [annRequiresAck, setAnnRequiresAck] = useState(false);
  const [activeAnn, setActiveAnn] = useState<UnifiedAnnouncement | null>(null);
  const [optimisticReadIds, setOptimisticReadIds] = useState<string[]>([]);

  const allAnnouncements = useMemo<UnifiedAnnouncement[]>(() => {
    const dbItems: UnifiedAnnouncement[] = news.map((n) => ({
      id: n.id,
      title: n.title,
      body_md: n.body_md || '',
      by: n.by,
      by_role: n.by_role,
      by_solved: n.by_solved,
      by_avatar: n.by_avatar,
      scope: n.mentees ? 'To mentees' : 'Everyone',
      at: n.at,
      edited_at: n.edited_at,
      pinned: n.pinned,
      requires_ack: n.requires_ack,
      read_count: counts.annReads?.[n.id] ?? n.read_count ?? 0,
    }));

    const seedItems: UnifiedAnnouncement[] = announcements.map((a) => {
      const author = who(a.from);
      const solved =
        'problems_solved' in author
          ? Number(author.problems_solved)
          : 'solved' in author
            ? Number(author.solved)
            : 0;
      const role = 'role' in author ? (author.role ?? null) : null;
      const avatar = 'avatar_url' in author ? (author.avatar_url ?? null) : null;
      return {
        id: a.id,
        title: a.title,
        body_md: a.body_md || a.body,
        by: author.name,
        by_role: role,
        by_solved: solved,
        by_avatar: avatar,
        scope: a.scope,
        at: a.at,
        edited_at: a.edited_at,
        pinned: Boolean(a.pinned),
        requires_ack: Boolean(a.requires_ack ?? a.must),
        read_count: counts.annReads?.[a.id] ?? 0,
      };
    });

    return [...dbItems, ...seedItems].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });
  }, [news, counts.annReads, who]);

  const isAnnRead = useCallback(
    (id: string) => s.read.includes(id) || optimisticReadIds.includes(id),
    [s.read, optimisticReadIds],
  );

  const unreadAnnCount = useMemo(
    () => allAnnouncements.filter((a) => !isAnnRead(a.id)).length,
    [allAnnouncements, isAnnRead],
  );

  const filteredAnnouncements = useMemo(() => {
    return allAnnouncements.filter((a) => {
      if (annFilter === 'unread') return !isAnnRead(a.id);
      if (annFilter === 'must') return a.requires_ack;
      return true;
    });
  }, [allAnnouncements, annFilter, isAnnRead]);

  const handleMarkAnnRead = useCallback(
    (id: string) => {
      setOptimisticReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      act('markAnnouncementRead', { id });
    },
    [act],
  );

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await act('announce', {
      title: annTitle.trim(),
      body_md: annBody.trim(),
      audience: can(s.role, 'announce.post') === 'scope' ? 'mentees' : annAudience,
      pinned: annPinned,
      requires_ack: annRequiresAck,
    });
    if (ok) {
      setAnnTitle('');
      setAnnBody('');
      setAnnPinned(false);
      setAnnRequiresAck(false);
    }
  };

  /* ────────── IDEAS STATE ────────── */
  const [ideaQ, setIdeaQ] = useState('');
  const [ideaDebouncedQ, setIdeaDebouncedQ] = useState('');
  const [ideaSort, setIdeaSort] = useState<'top' | 'new'>('top');
  const [ideaStatus, setIdeaStatus] = useState<'all' | Exclude<IdeaStatus, 'closed'>>('all');
  const [ideaType, setIdeaType] = useState<'all' | IdeaType>('all');
  const [ideaItems, setIdeaItems] = useState<IdeaSummary[]>([]);
  const [ideaCursor, setIdeaCursor] = useState<string | null>(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaInitialized, setIdeaInitialized] = useState(false);
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const [activeIdeaId, setActiveIdeaId] = useState<number | null>(null);
  const ideaSentinelRef = useRef<HTMLDivElement>(null);
  const ideaReqSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setIdeaDebouncedQ(ideaQ.trim()), 240);
    return () => clearTimeout(t);
  }, [ideaQ]);

  const fetchIdeas = useCallback(
    async (cursor: string | null, append: boolean) => {
      const seq = ++ideaReqSeq.current;
      setIdeaLoading(true);
      try {
        const res = await fetch('/api/community', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'listIdeas',
            q: ideaDebouncedQ,
            type: ideaType === 'all' ? undefined : ideaType,
            status: ideaStatus === 'all' ? undefined : ideaStatus,
            sort: ideaSort,
            cursor,
            limit: 20,
          }),
        });
        if (!res.ok || seq !== ideaReqSeq.current) return;
        const data = (await res.json()) as { items: IdeaSummary[]; nextCursor: string | null };
        setIdeaItems((prev) => {
          if (!append) return data.items;
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...data.items.filter((x) => !seen.has(x.id))];
        });
        setIdeaCursor(data.nextCursor);
        setIdeaInitialized(true);
      } finally {
        if (seq === ideaReqSeq.current) setIdeaLoading(false);
      }
    },
    [ideaDebouncedQ, ideaType, ideaStatus, ideaSort],
  );

  useEffect(() => {
    if (tab !== 'Ideas') return;
    fetchIdeas(null, false);
  }, [tab, fetchIdeas]);

  useEffect(() => {
    if (tab !== 'Ideas' || !ideaCursor || ideaLoading) return;
    const el = ideaSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchIdeas(ideaCursor, true);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, ideaCursor, ideaLoading, fetchIdeas]);

  const handleCreateIdea = async (data: {
    title: string;
    body_md: string;
    type: IdeaType;
    roles: string[];
  }) => {
    const ok = await act('createIdea', {
      title: data.title,
      body_md: data.body_md,
      ideaType: data.type,
      roles: data.roles,
    });
    if (ok) await fetchIdeas(null, false);
    return ok;
  };

  const handleIdeaUpvote = async (ideaId: number) => {
    const key = `idea:${ideaId}`;
    const wasOn = s.kudos.includes(key);
    setIdeaItems((prev) =>
      prev.map((it) =>
        it.id === ideaId ? { ...it, upvotes: Math.max(0, it.upvotes + (wasOn ? -1 : 1)) } : it,
      ),
    );
    const ok = await act('toggle', { list: 'kudos', id: key });
    if (!ok) await fetchIdeas(null, false);
  };

  /* ────────── DERIVED SIDEBAR DATA ────────── */
  const topHelpers = useMemo(
    () =>
      [...members]
        .filter((m) => !m.suspended)
        .sort((a, b) => b.helper - a.helper)
        .slice(0, 5),
    [members],
  );
  const activeMemberTotal = Math.max(1, members.filter((m) => !m.suspended).length);
  const isOfficer = !!can(s.role, 'announce.post') || isCommittee(s.role);

  return (
    <Page
      title={
        <>
          {tab}
          <span className="acc">.</span>
        </>
      }
    >
      <Tabs tabs={tabs} value={tab} onChange={handleTabChange} />

      {/* ────────── TAB 1: FEED ────────── */}
      {tab === 'Feed' && (
        <div className="bento cm-feed-bento">
          <div className="c8 stack" style={{ '--g': '16px' } as React.CSSProperties}>
            <input
              type="search"
              className="cm-search"
              value={feedQ}
              onChange={(e) => setFeedQ(e.target.value)}
              placeholder="Search post titles and bodies"
              aria-label="Search posts"
            />
            <div className="cm-chips" role="group" aria-label="Filter posts by category">
              {FEED_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`tag ${feedCat === f.key ? 'on' : ''}`}
                  aria-pressed={feedCat === f.key}
                  onClick={() => setFeedCat(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <section className="panel">
              {!feedInitialized && feedLoading ? (
                <p className="body">Loading posts…</p>
              ) : visibleFeedItems.length === 0 ? (
                <p className="empty">No posts match this filter yet.</p>
              ) : (
                <div className="list">
                  {visibleFeedItems.map((p) => (
                    <div key={p.id} className="cm-row-click" onClick={() => setActivePostId(p.id)}>
                      <VoteWidget
                        score={p.score}
                        myVote={p.my_vote}
                        disabled={me.system}
                        onVote={(val) => handleVoteFeed(p.id, val)}
                      />
                      <div className="grow">
                        <button
                          type="button"
                          className="cm-title"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePostId(p.id);
                          }}
                        >
                          <HighlightMatch text={p.title} query={feedQ} />
                        </button>
                        <p className="cm-excerpt">
                          <HighlightMatch text={excerptFromMarkdown(p.body_md)} query={feedQ} />
                        </p>
                        <div className="cm-meta">
                          <TierName name={p.author_name} solved={p.author_solved} />
                          <span>· {relTime(p.created_at)}</span>
                          <span className="pill" style={{ fontSize: 11, padding: '1px 6px' }}>
                            {feedCategoryChip(p.category)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={feedSentinelRef} className="cm-sentinel" aria-live="polite">
                {feedLoading && feedInitialized
                  ? 'Loading more posts…'
                  : feedCursor
                    ? 'Scroll for more posts'
                    : ''}
              </div>
            </section>
          </div>

          <aside className="c4 cm-feed-right">
            {!me.system && (
              <button
                type="button"
                className="btn sm"
                style={{ width: '100%' }}
                onClick={() => setNewPostOpen(true)}
              >
                + New Post
              </button>
            )}

            <section className="panel">
              <p className="label">Top helpers this week</p>
              <ol className="list">
                {topHelpers.map((m, i) => (
                  <li key={m.id}>
                    <span className="mono acc" style={{ width: 20 }}>
                      {i + 1}
                    </span>
                    <TierAvatar
                      name={m.name}
                      solved={m.problems_solved ?? m.solved}
                      avatarUrl={m.avatar_url}
                      size={32}
                    />
                    <span
                      className="grow"
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <TierName name={m.name} solved={m.problems_solved ?? m.solved} />
                    </span>
                    <span className="mono">{m.helper}</span>
                  </li>
                ))}
              </ol>
            </section>

            <MilestonesCard onOpenMember={handleOpenProfile} />
          </aside>
        </div>
      )}

      {/* ────────── TAB 2: ANNOUNCEMENTS ────────── */}
      {tab === 'Announcements' && (
        <div className="stack">
          {can(s.role, 'announce.post') && (
            <form
              className="panel stack"
              style={{ '--g': '14px' } as React.CSSProperties}
              onSubmit={handlePublishAnnouncement}
            >
              <p className="label">
                Publish announcement · scope:{' '}
                {can(s.role, 'announce.post') === 'scope'
                  ? 'only your mentees see this'
                  : 'club officers'}
              </p>
              <label className="field">
                <span className="label">Title</span>
                <input
                  className="input"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                  minLength={3}
                  maxLength={140}
                  placeholder="Headline for the announcement"
                />
              </label>
              <MarkdownEditor
                id="ann-body-md"
                label="Message (Markdown · supports @mentions and > blockquotes)"
                value={annBody}
                onChange={setAnnBody}
                rows={4}
                maxLength={6000}
                placeholder="Write details in Markdown… Use @everyone and > Date / Time / Venue lines"
              />
              <div className="row between" style={{ '--g': '12px' } as React.CSSProperties}>
                <div className="row" style={{ '--g': '16px' } as React.CSSProperties}>
                  {can(s.role, 'announce.post') === true && (
                    <label className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                      <span className="label">Audience</span>
                      <select
                        className="input"
                        style={{ minHeight: 38, width: 'auto' }}
                        value={annAudience}
                        onChange={(e) => setAnnAudience(e.target.value as 'all' | 'mentees')}
                      >
                        <option value="all">Everyone</option>
                        <option value="mentees">My mentees</option>
                      </select>
                    </label>
                  )}
                  <label
                    className="row"
                    style={{ cursor: 'pointer', '--g': '8px' } as React.CSSProperties}
                  >
                    <input
                      type="checkbox"
                      className="check"
                      checked={annPinned}
                      onChange={(e) => setAnnPinned(e.target.checked)}
                    />
                    <span className="label">Pin to top</span>
                  </label>
                  <label
                    className="row"
                    style={{ cursor: 'pointer', '--g': '8px' } as React.CSSProperties}
                  >
                    <input
                      type="checkbox"
                      className="check"
                      checked={annRequiresAck}
                      onChange={(e) => setAnnRequiresAck(e.target.checked)}
                    />
                    <span className="label">Require acknowledgement</span>
                  </label>
                </div>
                <button className="btn sm" type="submit">
                  Publish
                </button>
              </div>
            </form>
          )}

          <div className="cm-chips" role="group" aria-label="Filter announcements">
            <button
              type="button"
              className={`tag ${annFilter === 'all' ? 'on' : ''}`}
              aria-pressed={annFilter === 'all'}
              onClick={() => setAnnFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`tag ${annFilter === 'unread' ? 'on' : ''}`}
              aria-pressed={annFilter === 'unread'}
              onClick={() => setAnnFilter('unread')}
            >
              Unread {unreadAnnCount}
            </button>
            <button
              type="button"
              className={`tag ${annFilter === 'must' ? 'on' : ''}`}
              aria-pressed={annFilter === 'must'}
              onClick={() => setAnnFilter('must')}
            >
              Must read
            </button>
          </div>

          <section className="panel">
            {filteredAnnouncements.length === 0 ? (
              <p className="empty">No announcements match this filter.</p>
            ) : (
              <div className="list">
                {filteredAnnouncements.map((a) => {
                  const read = isAnnRead(a.id);
                  const optimisticReadCount =
                    a.read_count +
                    (!s.read.includes(a.id) && optimisticReadIds.includes(a.id) ? 1 : 0);
                  const pct = Math.min(
                    100,
                    Math.round((optimisticReadCount / activeMemberTotal) * 100),
                  );
                  return (
                    <div
                      key={a.id}
                      className="cm-row-click"
                      style={{ alignItems: 'flex-start' }}
                      onClick={() => setActiveAnn(a)}
                    >
                      <span
                        className={`cm-unread-dot ${read ? 'read' : ''}`}
                        style={{ marginTop: 6 }}
                        aria-label={read ? 'Read' : 'Unread'}
                      />
                      <div className="grow">
                        <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                          <button
                            type="button"
                            className="cm-title"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAnn(a);
                            }}
                          >
                            {a.title}
                          </button>
                          {a.pinned && (
                            <span className="pill" style={{ fontSize: 11, padding: '1px 6px' }}>
                              Pinned
                            </span>
                          )}
                          {a.requires_ack && (
                            <span
                              className="pill warn"
                              style={{ fontSize: 11, padding: '1px 6px' }}
                            >
                              Must read
                            </span>
                          )}
                        </div>
                        {a.body_md && (
                          <p className="cm-excerpt">{excerptFromMarkdown(a.body_md)}</p>
                        )}
                        <div className="cm-meta">
                          <TierName name={a.by} solved={a.by_solved} />
                          <span>· {a.scope}</span>
                          <span>· {relTime(a.at)}</span>
                        </div>
                        {isOfficer && (
                          <div
                            className="row"
                            style={
                              { marginTop: 8, '--g': '10px', maxWidth: 320 } as React.CSSProperties
                            }
                          >
                            <div
                              className="meter grow"
                              style={{ '--v': `${pct}%`, height: 6 } as React.CSSProperties}
                            >
                              <i />
                            </div>
                            <span className="label" style={{ fontSize: 11 }}>
                              Read by {optimisticReadCount} of {activeMemberTotal}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ────────── TAB 3: IDEAS (merged with Teammates) ────────── */}
      {tab === 'Ideas' && (
        <div className="stack" style={{ '--g': '16px' } as React.CSSProperties}>
          <div className="row between" style={{ '--g': '12px' } as React.CSSProperties}>
            <input
              type="search"
              className="cm-search grow"
              style={{ maxWidth: 420 }}
              value={ideaQ}
              onChange={(e) => setIdeaQ(e.target.value)}
              placeholder="Search ideas, teammate requests, or study sessions"
              aria-label="Search ideas"
            />
            {!me.system && (
              <button type="button" className="btn sm" onClick={() => setNewIdeaOpen(true)}>
                + Submit Idea
              </button>
            )}
          </div>

          <div className="row between" style={{ '--g': '12px' } as React.CSSProperties}>
            <div className="cm-chips" role="group" aria-label="Sort ideas">
              <button
                type="button"
                className={`tag ${ideaSort === 'top' ? 'on' : ''}`}
                aria-pressed={ideaSort === 'top'}
                onClick={() => setIdeaSort('top')}
              >
                Top
              </button>
              <button
                type="button"
                className={`tag ${ideaSort === 'new' ? 'on' : ''}`}
                aria-pressed={ideaSort === 'new'}
                onClick={() => setIdeaSort('new')}
              >
                New
              </button>
            </div>

            <div className="cm-chips" role="group" aria-label="Filter ideas by type">
              {IDEA_TYPE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`tag ${ideaType === f.key ? 'on' : ''}`}
                  aria-pressed={ideaType === f.key}
                  onClick={() => setIdeaType(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="cm-chips" role="group" aria-label="Filter ideas by status">
              {IDEA_STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`tag ${ideaStatus === f.key ? 'on' : ''}`}
                  aria-pressed={ideaStatus === f.key}
                  onClick={() => setIdeaStatus(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <section className="panel">
            {!ideaInitialized && ideaLoading ? (
              <p className="body">Loading ideas…</p>
            ) : ideaItems.length === 0 ? (
              <p className="empty">No ideas match those filters yet.</p>
            ) : (
              <div className="list">
                {ideaItems.map((it) => {
                  const mine = it.user_id === me.id;
                  const upOn = s.kudos.includes(`idea:${it.id}`);
                  return (
                    <div
                      key={it.id}
                      className="cm-row-click"
                      style={{ flexWrap: 'wrap' }}
                      onClick={() => setActiveIdeaId(it.id)}
                    >
                      <span className="cm-idea-score">{it.upvotes}</span>
                      <div className="grow">
                        <button
                          type="button"
                          className="cm-title"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveIdeaId(it.id);
                          }}
                        >
                          <HighlightMatch text={it.title} query={ideaQ} />
                        </button>
                        <p className="cm-excerpt">
                          <HighlightMatch text={excerptFromMarkdown(it.body_md)} query={ideaQ} />
                        </p>
                        <div className="cm-meta">
                          <TierName name={it.author_name} solved={it.author_solved} />
                          <span>· {relTime(it.created_at)}</span>
                          <span className="pill" style={{ fontSize: 11, padding: '1px 6px' }}>
                            {ideaTypeLabel(it.type)}
                          </span>
                          <span
                            className={`pill ${it.status === 'shipped' ? 'ok' : it.status === 'closed' ? 'bad' : ''}`}
                            style={{ fontSize: 11, padding: '1px 6px' }}
                          >
                            {it.status}
                          </span>
                        </div>
                      </div>

                      <div
                        className="row"
                        style={{ '--g': '8px', flexWrap: 'wrap' } as React.CSSProperties}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={`btn xs ${upOn ? '' : 'line'}`}
                          aria-pressed={upOn}
                          onClick={() => handleIdeaUpvote(it.id)}
                        >
                          ▲ {it.upvotes}
                        </button>
                        <span className="cm-inert-pill">💬 {it.comment_count}</span>
                        <span className="cm-inert-pill">Interested ({it.interested_count})</span>
                        {mine && (
                          <>
                            <span className="pill">you</span>
                            <button
                              type="button"
                              className="btn xs line"
                              onClick={() => setActiveIdeaId(it.id)}
                            >
                              Manage interested
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={ideaSentinelRef} className="cm-sentinel" aria-live="polite">
              {ideaLoading && ideaInitialized
                ? 'Loading more ideas…'
                : ideaCursor
                  ? 'Scroll for more ideas'
                  : ''}
            </div>
          </section>
        </div>
      )}

      {/* ────────── TAB 4: POLLS (unchanged) ────────── */}
      {tab === 'Polls' && (
        <div className="bento">
          {polls.map((p) => {
            const mine = s.votes[p.id];
            const live = counts.votes[p.id] ?? {};
            const total = p.opts.reduce((a, o) => a + o[1] + (live[o[0]] ?? 0), 0);
            return (
              <section key={p.id} className="panel c6">
                <h2 className="h3">{p.q}</h2>
                {p.opts.map(([o, n]) => {
                  const v = n + (live[o] ?? 0);
                  return (
                    <button
                      key={o}
                      className="opt"
                      aria-pressed={mine === o}
                      onClick={() => act('vote', { poll: p.id, option: o })}
                    >
                      {mine && <i style={{ width: `${(v / total) * 100}%` }} />}
                      <span>
                        <b className="mono acc" style={{ marginRight: 10 }}>
                          {mine === o ? '●' : '○'}
                        </b>
                        {o}
                      </span>
                      <span className="mono">
                        {mine ? `${Math.round((v / total) * 100)}%` : ''}
                      </span>
                    </button>
                  );
                })}
                <p className="label">
                  {total} votes · closes Friday{mine ? '' : ' · vote to see results'}
                </p>
              </section>
            );
          })}
        </div>
      )}

      {/* ────────── TAB 5: GROUPS (unchanged) ────────── */}
      {tab === 'Groups' && (
        <div className="bento">
          {groupsData.map(([n, lead, count]) => {
            const k = 'group:' + n;
            const on = s.flags[k] ?? n === 'Competitive Programming';
            return (
              <section key={n} className="panel c4">
                <p className="label">
                  {count + (on && n !== 'Competitive Programming' ? 1 : 0)} members · lead{' '}
                  {who(lead).name.split(' ')[0]}
                </p>
                <h2 className="h3">{n}</h2>
                <button
                  className={`btn sm ${on ? 'line' : ''}`}
                  aria-pressed={on}
                  onClick={() => act('flag', { key: k, on: !on })}
                >
                  {on ? 'Joined ✓' : 'Join group'}
                </button>
              </section>
            );
          })}
        </div>
      )}

      {/* ────────── TAB 6: SUGGEST (unchanged) ────────── */}
      {tab === 'Suggest' && <Suggest />}

      {/* ────────── MODALS ────────── */}
      <NewPostModal
        open={newPostOpen}
        onClose={() => setNewPostOpen(false)}
        onPublish={handlePublishFeed}
      />

      <PostModal
        postId={activePostId}
        onClose={() => setActivePostId(null)}
        onSelectPost={(id) => setActivePostId(id)}
        onVote={handleVoteFeed}
        onMutated={() => fetchFeed(null, false)}
      />

      <AnnouncementModal
        item={activeAnn}
        alreadyRead={activeAnn ? isAnnRead(activeAnn.id) : false}
        onMarkRead={handleMarkAnnRead}
        onClose={() => setActiveAnn(null)}
      />

      <NewIdeaModal
        open={newIdeaOpen}
        onClose={() => setNewIdeaOpen(false)}
        onSubmit={handleCreateIdea}
      />

      <IdeaModal
        ideaId={activeIdeaId}
        onClose={() => setActiveIdeaId(null)}
        onMutated={() => fetchIdeas(null, false)}
      />

      {activeProfileId && (
        <ProfileModal userId={activeProfileId} onClose={handleCloseProfile} onMutated={() => {}} />
      )}
    </Page>
  );
}

function CommunityInner() {
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get('tab') || '').toLowerCase();
  const isAlumni = ['alumni', 'jobs', 'prep', 'blogs'].includes(tabParam);
  if (isAlumni) {
    return <AlumniPage />;
  }
  return <CommunityContent />;
}

export default function Community() {
  return (
    <Suspense
      fallback={
        <Page
          title={
            <>
              Community<span className="acc">.</span>
            </>
          }
        >
          <p className="body">Loading…</p>
        </Page>
      }
    >
      <CommunityInner />
    </Suspense>
  );
}
