'use client';
import { useMore } from '@/components/site/More';
import { SaveForm } from '@/components/app/SaveBar';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { AnnouncementBoard } from '@/components/app/announcements/AnnouncementBoard';
import type { UnifiedAnnouncement } from '@/components/app/announcements/AnnouncementModal';
import { MilestonesCard } from '@/components/app/feed/MilestonesCard';
import { ReportsPanel } from '@/components/app/feed/ReportsPanel';
import { VoteWidget } from '@/components/app/feed/VoteWidget';
import type { JoinIdeaTarget } from '@/components/app/ideas/JoinIdeaModal';
import {
  excerptFromMarkdown,
  MarkdownEditor,
  relTime,
} from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { HighlightMatch } from '@/components/app/alumni/HighlightMatch';
import { announcements } from '@fecpc/content/member-area';
import { can, canFully, isCommittee, rankFor } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';
import type {
  FeedCategory,
  FeedPostSummary,
  IdeaStatus,
  IdeaSummary,
  IdeaType,
} from '@fecpc/contracts';
import { cmMeta, feedCategoryChip } from '@/components/app/feed/ui';
import {
  cmChips,
  cmIdeaMeta,
  cmIdeaTags,
  cmIdeaTag,
  cmIdeaAcceptedBadge,
  cmIdeaInterestedLabel,
  cmIdeaStatusBadge,
  ideaTypeLabel,
} from '@/components/app/ideas/ui';
import {
  annModalBackdrop,
  annModal,
  annModalHeader,
  annCloseBtn,
  annModalBody,
  annBackdrop,
} from '@/components/app/announcements/ui';

// Dialogs render nothing until opened: their code loads on demand instead of with the page.
const NewPostModal = dynamic(() =>
  import('@/components/app/feed/NewPostModal').then((m) => m.NewPostModal),
);
const PostModal = dynamic(() => import('@/components/app/feed/PostModal').then((m) => m.PostModal));
const AnnouncementModal = dynamic(() =>
  import('@/components/app/announcements/AnnouncementModal').then((m) => m.AnnouncementModal),
);
const NewIdeaModal = dynamic(() =>
  import('@/components/app/ideas/NewIdeaModal').then((m) => m.NewIdeaModal),
);
const ManageInterestedModal = dynamic(() =>
  import('@/components/app/ideas/ManageInterestedModal').then((m) => m.ManageInterestedModal),
);
const JoinIdeaModal = dynamic(() =>
  import('@/components/app/ideas/JoinIdeaModal').then((m) => m.JoinIdeaModal),
);
const IdeaModal = dynamic(() =>
  import('@/components/app/ideas/IdeaModal').then((m) => m.IdeaModal),
);
const ProfileModal = dynamic(() =>
  import('@/components/app/members/ProfileModal').then((m) => m.ProfileModal),
);

const annField =
  '[&>label]:block [&>label]:[font-family:var(--ann-font-mono)] [&>label]:[font-size:0.8rem] [&>label]:mb-[0.5rem] [&>label]:uppercase [&>label]:[color:var(--ann-muted)] mb-[1.25rem]';

const annBtnPrimary =
  '[box-shadow:4px_4px_0_rgba(0,_0,_0,_0.6)] hover:[box-shadow:6px_6px_0_rgba(0,_0,_0,_0.6)] [.t-b_&]:[box-shadow:4px_4px_0_rgba(0,_0,_0,_0.2)] [.t-b_&:hover]:[box-shadow:6px_6px_0_rgba(0,_0,_0,_0.2)] [.t-d_&]:[box-shadow:4px_4px_0_#000000] [.t-d_&:hover]:[box-shadow:6px_6px_0_#000000]'; // was .ann-btn-primary
const annFilterBtn =
  'py-[0.4rem] px-[0.8rem] [background:transparent] [font-family:var(--ann-font-mono)] text-[0.75rem] font-bold cursor-pointer [color:var(--ann-text)] uppercase [transition:background-color_0.1s,_color_0.1s,_border-color_0.1s] [&.active]:[background-color:var(--ann-blue)] [&.active]:text-[#ffffff] [.t-d_&.active]:bg-acc [.t-d_&.active]:text-on [&&:hover:not(.active)]:[background:color-mix(in_srgb,_var(--ann-text)_8%,_transparent)]'; // was .ann-filter-btn
const annCheckboxGroup = 'mb-[1rem]'; // was .ann-checkbox-group

const cmSearch =
  'py-0 px-3.5 min-h-[44px] w-full font-body text-[15px] focus:[outline:2px_solid_var(--acc)] focus:[outline-offset:2px]'; // was .cm-search
const cmSentinel =
  'text-center font-label text-[12px] tracking-[0.08em] uppercase [color:var(--dim)]'; // was .cm-sentinel
const cmIdeasFilter =
  'flex-wrap [&:nth-child(1)]:justify-start [&:nth-child(2)]:justify-center [&:nth-child(3)]:justify-end [@media(max-width:768px)]:[&:nth-child(n)]:justify-start'; // was .cm-ideas-filter
const cmIdeasPill =
  'cm-ideas-pill [border:1px_solid_var(--line2)] hover:border-acc [&.on]:border-acc py-[3px] px-[9px] [background:transparent] font-label text-[11px] tracking-[0.05em] leading-[1.5] uppercase [color:var(--mut)] cursor-pointer [transition:background_0.15s_ease,_color_0.15s_ease,_border-color_0.15s_ease] hover:text-acc [&.on]:[background:var(--acc)] [&.on]:text-on focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px]'; // was .cm-ideas-pill

const tabs = ['Feed', 'Announcements', 'Ideas', 'Polls'] as const;
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
  return tabs.find((t) => t.toLowerCase() === lower) ?? 'Feed';
}

/** The feed's first page for the default filters, rendered with the HTML by page.tsx. */
export type FeedFirst = { items: FeedPostSummary[]; nextCursor: string | null };

function CommunityContent({ initialFeed }: { initialFeed: FeedFirst | null }) {
  const sure = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { s, me, act, counts, news, polls, who } = useStore();
  const [pollsShown, pollsMore] = useMore(polls, 10, true);
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')));
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    searchParams.get('profile'),
  );
  const lastProfileTriggerRef = useRef<HTMLElement | null>(null);

  const handleTabChange = useCallback(
    (nextTab: Tab) => {
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
  const [feedSort, setFeedSort] = useState<'hot' | 'new'>('hot');
  const [feedMine, setFeedMine] = useState(false);
  const [feedItems, setFeedItems] = useState<FeedPostSummary[]>(initialFeed?.items ?? []);
  const [feedCursor, setFeedCursor] = useState<string | null>(initialFeed?.nextCursor ?? null);
  const [feedLoading, setFeedLoading] = useState(!initialFeed);
  const [feedInitialized, setFeedInitialized] = useState(!!initialFeed);
  const feedServed = useRef(!!initialFeed); // the server sent the first page for the default filters
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
            sort: feedSort,
            mine: feedMine,
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
    [feedDebouncedQ, feedCat, feedSort, feedMine],
  );

  useEffect(() => {
    if (tab !== 'Feed') return;
    if (feedServed.current) return void (feedServed.current = false);
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
  const [annPinned, setAnnPinned] = useState(false);
  const [annRequiresAck, setAnnRequiresAck] = useState(false);
  const [activeAnn, setActiveAnn] = useState<UnifiedAnnouncement | null>(null);
  const canAnnounce = !!can(s.roles, 'announce.post');
  const [composeOpen, setComposeOpen] = useState(false);
  const [optimisticReadIds, setOptimisticReadIds] = useState<string[]>([]);

  useEffect(() => {
    if (!composeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetAnnouncement();
        setComposeOpen(false);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [composeOpen]);

  const allAnnouncements = useMemo<UnifiedAnnouncement[]>(() => {
    const dbItems: UnifiedAnnouncement[] = news.map((n) => ({
      id: n.id,
      title: n.title,
      body_md: n.body_md || '',
      by: n.by,
      by_role: n.by_role,
      by_solved: n.by_solved,
      by_avatar: n.by_avatar,
      scope: 'Everyone',
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

  // `?tab=announcements&open=<id>` (from Today and the inbox) opens that announcement.
  const openParam = searchParams.get('open');
  useEffect(() => {
    if (!openParam) return;
    const hit = allAnnouncements.find((a) => a.id === openParam);
    if (hit) setActiveAnn(hit);
  }, [openParam, allAnnouncements]);

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

  const resetAnnouncement = () => {
    setAnnTitle('');
    setAnnBody('');
    setAnnPinned(false);
    setAnnRequiresAck(false);
  };
  const handlePublishAnnouncement = async () => {
    const ok = await act('announce', {
      title: annTitle.trim(),
      body_md: annBody.trim(),
      pinned: annPinned,
      requires_ack: annRequiresAck,
    });
    if (ok) resetAnnouncement();
    return ok;
  };

  /* ────────── IDEAS STATE ────────── */
  const [ideaQ, setIdeaQ] = useState('');
  const [ideaDebouncedQ, setIdeaDebouncedQ] = useState('');
  const [ideaSort, setIdeaSort] = useState<'top' | 'new'>('top');
  const [ideaStatus, setIdeaStatus] = useState<'all' | Exclude<IdeaStatus, 'closed'>>('all');
  const [ideaType, setIdeaType] = useState<'all' | IdeaType>('all');
  const [ideaMine, setIdeaMine] = useState(false);
  const [ideaItems, setIdeaItems] = useState<IdeaSummary[]>([]);
  const [ideaCursor, setIdeaCursor] = useState<string | null>(null);
  const [ideaLoading, setIdeaLoading] = useState(true);
  const [ideaInitialized, setIdeaInitialized] = useState(false);
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const [activeIdeaId, setActiveIdeaId] = useState<number | null>(null);
  const [manageIdeaId, setManageIdeaId] = useState<number | null>(null);
  const [joinIdea, setJoinIdea] = useState<JoinIdeaTarget | null>(null);
  const [joiningIdeaId, setJoiningIdeaId] = useState<number | null>(null);
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
            mine: ideaMine,
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
    [ideaDebouncedQ, ideaType, ideaStatus, ideaSort, ideaMine],
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
    if (s.kudos.includes(key)) return; // kudos are permanent
    setIdeaItems((prev) =>
      prev.map((it) => (it.id === ideaId ? { ...it, upvotes: it.upvotes + 1 } : it)),
    );
    const ok = await act('toggle', { list: 'kudos', id: key, on: true });
    if (!ok) await fetchIdeas(null, false);
  };

  const handleCardJoin = async (idea: IdeaSummary) => {
    if (joiningIdeaId !== null || idea.my_interest || idea.status === 'closed' || me.system) return;
    if (idea.roles.length > 0) {
      setJoinIdea({
        id: idea.id,
        title: idea.title,
        author_name: idea.author_name,
        roles: idea.roles,
      });
      return;
    }
    setJoiningIdeaId(idea.id);
    const ok = await act('expressInterest', { ideaId: idea.id, response: {} });
    setJoiningIdeaId(null);
    if (ok) await fetchIdeas(null, false);
  };

  /* ────────── POLLS STATE ────────── */
  const canPoll = canFully(s.roles, 'poll.create');
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState('');
  const resetPoll = () => {
    setPollQ('');
    setPollOpts('');
  };
  const handleCreatePoll = async () => {
    const options = pollOpts
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
    const ok = await act('createPoll', { question: pollQ.trim(), options });
    if (ok) resetPoll();
    return ok;
  };

  /* ────────── DERIVED SIDEBAR DATA ────────── */
  const topHelpers = counts.topHelpers; // from the server, so the panel does not wait for the roster
  const activeMemberTotal = Math.max(1, counts.peopleCount);
  const isOfficer = !!can(s.roles, 'announce.post') || isCommittee(s.roles);

  return (
    <Page
      title={
        <>
          {tab}
          <span className="acc">.</span>
        </>
      }
      aside={
        tab === 'Announcements' && canAnnounce ? (
          <button
            type="button"
            className={`ann-btn-primary ${annBtnPrimary}`}
            onClick={() => setComposeOpen(true)}
          >
            + Publish
          </button>
        ) : undefined
      }
    >
      {tab !== 'Announcements' && <Tabs tabs={tabs} value={tab} onChange={handleTabChange} />}

      {/* ────────── TAB 1: FEED ────────── */}
      {tab === 'Feed' && (
        <div className="bento cm-feed-bento [align-items:start]">
          <div className="c8 stack [--g:16px]">
            <input
              type="search"
              className={`cm-search ${cmSearch}`}
              value={feedQ}
              onChange={(e) => setFeedQ(e.target.value)}
              placeholder="Search post titles and bodies"
              aria-label="Search posts"
            />
            <div
              className={`cm-chips flex gap-2 items-center ${cmChips}`}
              role="group"
              aria-label="Filter posts by category"
            >
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
              <span aria-hidden>·</span>
              {(['hot', 'new'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`tag ${feedSort === k ? 'on' : ''}`}
                  aria-pressed={feedSort === k}
                  onClick={() => setFeedSort(k)}
                >
                  {k === 'hot' ? 'Best' : 'New'}
                </button>
              ))}
              {!me.system && (
                <button
                  type="button"
                  className={`tag ${feedMine ? 'on' : ''}`}
                  aria-pressed={feedMine}
                  onClick={() => setFeedMine(!feedMine)}
                >
                  My posts
                </button>
              )}
            </div>

            <section className="panel">
              {!feedInitialized && feedLoading ? (
                <p className="body">Loading posts…</p>
              ) : visibleFeedItems.length === 0 ? (
                <p className="empty">No posts match this filter yet.</p>
              ) : (
                <div className="list">
                  {visibleFeedItems.map((p) => (
                    <div
                      key={p.id}
                      className="cm-row-click cursor-pointer"
                      onClick={() => setActivePostId(p.id)}
                    >
                      <VoteWidget
                        score={p.score}
                        myVote={p.my_vote}
                        disabled={me.system}
                        onVote={(val) => handleVoteFeed(p.id, val)}
                      />
                      <div className="grow">
                        <button
                          type="button"
                          className="[border:0] [.cm-row-click:hover_&]:text-acc p-0 block text-[16px] font-semibold text-hi text-left [background:none] cursor-pointer hover:text-acc focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePostId(p.id);
                          }}
                        >
                          <HighlightMatch text={p.title} query={feedQ} />
                        </button>
                        <p className="mt-1 mx-0 mb-1.5 text-[14px] leading-[1.45] [color:var(--mut)] whitespace-nowrap overflow-hidden text-ellipsis">
                          <HighlightMatch text={excerptFromMarkdown(p.body_md)} query={feedQ} />
                        </p>
                        <div
                          className={`cm-meta flex flex-wrap items-center gap-1.5 tracking-[0.05em] ${cmMeta}`}
                        >
                          <TierName name={p.author_name} solved={p.author_solved} />
                          <span>· {relTime(p.created_at)}</span>
                          <span className="pill text-[11px] py-[1px] px-1.5">
                            {feedCategoryChip(p.category)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div
                ref={feedSentinelRef}
                className={`cm-sentinel p-[16px_0] ${cmSentinel}`}
                aria-live="polite"
              >
                {feedLoading && feedInitialized
                  ? 'Loading more posts…'
                  : feedCursor
                    ? 'Scroll for more posts'
                    : ''}
              </div>
            </section>
          </div>

          <aside className="c4 flex flex-col gap-4 [@media(max-width:759px)]:order-[-1]">
            {!me.system && (
              <button
                type="button"
                className="btn sm w-full"

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
                    <span className="mono acc w-[20px]">{i + 1}</span>
                    <TierAvatar
                      name={m.name}
                      solved={m.solved}
                      avatarUrl={m.avatar_url}
                      size={32}
                    />
                    <span className="grow min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                      <TierName name={m.name} solved={m.solved} />
                    </span>
                    <span className="mono">{m.helper}</span>
                  </li>
                ))}
              </ol>
            </section>

            {can(s.roles, 'feed.moderate') && (
              <ReportsPanel onOpen={setActivePostId} onChange={() => fetchFeed(null, false)} />
            )}

            <MilestonesCard onOpenMember={handleOpenProfile} />
          </aside>
        </div>
      )}

      {/* ────────── TAB 2: ANNOUNCEMENTS ────────── */}
      {tab === 'Announcements' && (
        <div className="ann-container [font-family:var(--ann-font-main)] leading-[1.6]">
          <div className="mb-[1.5rem]">
            <div className="ann-nav-tabs flex gap-[0.5rem] mb-[0.75rem] flex-wrap">
              <Tabs tabs={tabs} value={tab} onChange={handleTabChange} />
            </div>
            <div
              className="flex gap-[0.5rem] mb-[1rem] flex-wrap"
              role="group"
              aria-label="Filter announcements"
            >
              <button
                type="button"
                className={`ann-filter-btn ${annFilterBtn} ${annFilter === 'all' ? 'active' : ''}`}
                aria-pressed={annFilter === 'all'}
                onClick={() => setAnnFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`ann-filter-btn ${annFilterBtn} ${annFilter === 'unread' ? 'active' : ''}`}
                aria-pressed={annFilter === 'unread'}
                onClick={() => setAnnFilter('unread')}
              >
                Unread {unreadAnnCount}
              </button>
              <button
                type="button"
                className={`ann-filter-btn ${annFilterBtn} ${annFilter === 'must' ? 'active' : ''}`}
                aria-pressed={annFilter === 'must'}
                onClick={() => setAnnFilter('must')}
              >
                Must Read
              </button>
            </div>
          </div>

          <main>
            <AnnouncementBoard
              items={filteredAnnouncements}
              isRead={isAnnRead}
              readCount={(a) =>
                a.read_count + (!s.read.includes(a.id) && optimisticReadIds.includes(a.id) ? 1 : 0)
              }
              onMarkRead={handleMarkAnnRead}
              onOpen={setActiveAnn}
              isOfficer={isOfficer}
              memberTotal={activeMemberTotal}
            />
          </main>

          {composeOpen && (
            <div
              className={`${annBackdrop} ${annModalBackdrop}`}
              role="dialog"
              aria-modal="true"
              aria-label="Publish Announcement"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  resetAnnouncement();
                  setComposeOpen(false);
                }
              }}
            >
              <div className={`ann-modal ${annModal} publish-modal`}>
                <div
                  className={`ann-modal-header flex justify-between items-center p-[1.25rem_1.5rem] ${annModalHeader}`}
                >
                  <div className="mono [color:var(--ann-muted)] font-bold">
                    Publish · Everyone sees this
                  </div>
                  <button
                    type="button"
                    className={`ann-close-btn [border:var(--ann-border-thick)] ${annCloseBtn}`}
                    aria-label="Close"
                    onClick={() => {
                      resetAnnouncement();
                      setComposeOpen(false);
                    }}
                  >
                    &times;
                  </button>
                </div>
                <div
                  className={`ann-modal-body p-[1.5rem] max-[601px]:p-[1.25rem] ${annModalBody}`}
                >
                  <SaveForm
                    label="Unpublished announcement"
                    saveLabel="Publish"
                    onDiscard={() => {
                      resetAnnouncement();
                      setComposeOpen(false);
                    }}
                    onSubmit={async () => {
                      const ok = await handlePublishAnnouncement();
                      if (ok) setComposeOpen(false);
                    }}
                  >
                    <div className={annField}>
                      <label htmlFor="ann-title">Title</label>
                      <input
                        id="ann-title"
                        type="text"
                        className="ann-form-control p-[0.75rem] w-full [font-family:var(--ann-font-main)] text-[1rem] [border-radius:0] focus:[outline:2px_solid_var(--ann-blue)] focus:[outline-offset:-2px] [.t-d_&:focus]:[outline:2px_solid_var(--acc)] [.t-d_&:focus]:[outline-offset:-2px]"
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                        required
                        minLength={3}
                        maxLength={140}
                        placeholder="e.g., Codeforces Round #800 Div 2"
                      />
                    </div>

                    <div className={annField}>
                      <MarkdownEditor
                        id="ann-body-md"
                        label="Message (Markdown Supported)"
                        value={annBody}
                        onChange={setAnnBody}
                        rows={5}
                        maxLength={6000}
                        placeholder="Supports @mentions and > Date / Time / Venue lines"
                      />
                    </div>

                    <div className="mb-[2rem]">
                      <div className={`ann-checkbox-group ${annCheckboxGroup}`}>
                        <input
                          type="checkbox"
                          id="pin-top"
                          checked={annPinned}
                          onChange={(e) => setAnnPinned(e.target.checked)}
                        />
                        <label htmlFor="pin-top">Pin to top of feed</label>
                      </div>
                      <div className={`ann-checkbox-group ${annCheckboxGroup}`}>
                        <input
                          type="checkbox"
                          id="req-ack"
                          checked={annRequiresAck}
                          onChange={(e) => setAnnRequiresAck(e.target.checked)}
                        />
                        <label htmlFor="req-ack">Require acknowledgement (Must Read)</label>
                      </div>
                    </div>

                    <button type="submit" className={`ann-btn-primary ${annBtnPrimary} w-full`}>
                      Publish Announcement
                    </button>
                  </SaveForm>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────── TAB 3: IDEAS (merged with Teammates) ────────── */}
      {tab === 'Ideas' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4 max-[769px]:items-stretch [@media(max-width:768px)]:flex-col">
            <input
              type="search"
              className={`cm-search ${cmSearch} flex-[1_1_auto] min-w-0 max-w-[none]`}
              value={ideaQ}
              onChange={(e) => setIdeaQ(e.target.value)}
              placeholder="Search ideas, teammate requests, or study sessions"
              aria-label="Search ideas"
            />
            {!me.system && (
              <button
                type="button"
                className="btn sm flex-none"
                onClick={() => setNewIdeaOpen(true)}
              >
                + Submit Idea
              </button>
            )}
          </div>

          <div className="[display:grid] items-center gap-6 pb-4 max-[769px]:gap-3 grid-cols-[minmax(0,_1fr)_auto_minmax(0,_1fr)] [border-bottom:2px_solid_var(--line2)] [@media(max-width:768px)]:grid-cols-[minmax(0,_1fr)]">
            <div
              className={`cm-ideas-filter flex items-center gap-2 ${cmIdeasFilter}`}
              role="group"
              aria-label="Sort ideas"
            >
              <button
                type="button"
                className={`${cmIdeasPill} ${ideaSort === 'top' ? 'on' : ''}`}
                aria-pressed={ideaSort === 'top'}
                onClick={() => setIdeaSort('top')}
              >
                Best
              </button>
              <button
                type="button"
                className={`${cmIdeasPill} ${ideaSort === 'new' ? 'on' : ''}`}
                aria-pressed={ideaSort === 'new'}
                onClick={() => setIdeaSort('new')}
              >
                New
              </button>
              {!me.system && (
                <button
                  type="button"
                  className={`${cmIdeasPill} ${ideaMine ? 'on' : ''}`}
                  aria-pressed={ideaMine}
                  onClick={() => setIdeaMine(!ideaMine)}
                >
                  My Ideas
                </button>
              )}
            </div>

            <div
              className={`cm-ideas-filter flex items-center gap-2 ${cmIdeasFilter}`}
              role="group"
              aria-label="Filter ideas by type"
            >
              {IDEA_TYPE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`${cmIdeasPill} ${ideaType === f.key ? 'on' : ''}`}
                  aria-pressed={ideaType === f.key}
                  onClick={() => setIdeaType(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div
              className={`cm-ideas-filter flex items-center gap-2 ${cmIdeasFilter}`}
              role="group"
              aria-label="Filter ideas by status"
            >
              {IDEA_STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`${cmIdeasPill} ${ideaStatus === f.key ? 'on' : ''}`}
                  aria-pressed={ideaStatus === f.key}
                  onClick={() => setIdeaStatus(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {!ideaInitialized && ideaLoading ? (
            <p className="body">Loading ideas…</p>
          ) : ideaItems.length === 0 ? (
            <p className="empty">No ideas match those filters yet.</p>
          ) : (
            <div className="flex gap-4 flex-col">
              {ideaItems.map((it) => {
                const mine = it.user_id === me.id;
                const upOn = s.kudos.includes(`idea:${it.id}`);
                return (
                  <article
                    key={it.id}
                    className={`[border:2px_solid_var(--line2)] focus-within:border-acc p-5 [display:grid] grid-cols-[64px_minmax(0,_1fr)_auto] items-start gap-6 [background:var(--panel)] cursor-pointer [transition:transform_0.1s_ease,_box-shadow_0.1s_ease,_border-color_0.1s_ease] hover:[transform:translate(-2px,_-2px)] hover:[box-shadow:4px_4px_0_var(--line2)] [@media(max-width:768px)]:p-4 [@media(max-width:768px)]:grid-cols-[minmax(0,_1fr)] [@media(max-width:768px)]:gap-4 ${mine ? ' is-mine' : ''}`}
                    onClick={() => setActiveIdeaId(it.id)}
                  >
                    <div className="flex items-center gap-2 max-[769px]:justify-start max-[769px]:gap-3 flex-col [@media(max-width:768px)]:flex-row [@media(max-width:768px)]:w-full">
                      <button
                        type="button"
                        className={`[border:2px_solid_var(--ink)] [&:hover:not(:disabled)]:border-acc [&.on]:border-acc p-0 [display:grid] [place-items:center] w-[44px] h-[44px] [background:var(--bg)] text-ink text-[18px] leading-[1] cursor-pointer [transition:background_0.1s_ease,_color_0.1s_ease,_border-color_0.1s_ease] [&:hover:not(:disabled)]:[background:var(--acc)] [&:hover:not(:disabled)]:text-on [&.on]:[background:var(--acc)] [&.on]:text-on disabled:opacity-[0.45] disabled:cursor-not-allowed focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px] [@media(max-width:768px)]:w-[36px] [@media(max-width:768px)]:h-[36px] ${upOn ? ' on' : ''}`}
                        aria-pressed={upOn}
                        aria-label={upOn ? 'Upvoted' : 'Upvote idea'}
                        disabled={mine || me.system || upOn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIdeaUpvote(it.id);
                        }}
                      >
                        ▲
                      </button>
                      <span
                        className={`[font-family:var(--mono),_monospace] text-[18px] font-bold leading-[1.2] text-hi [font-variant-numeric:tabular-nums] [&.on]:text-acc ${upOn ? ' on' : ''}`}
                      >
                        {it.upvotes}
                      </span>
                    </div>

                    <div className="flex gap-2 min-w-0 pt-0.5 max-[769px]:pt-0 flex-col">
                      <button
                        type="button"
                        className="[border:0] p-0 block w-full [background:none] text-hi font-disp text-[20px] font-bold leading-[1.3] text-left cursor-pointer hover:text-acc focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px] [@media(max-width:768px)]:text-[18px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveIdeaId(it.id);
                        }}
                      >
                        <HighlightMatch text={it.title} query={ideaQ} />
                      </button>
                      <p className="mt-0 mx-0 mb-2 [display:-webkit-box] overflow-hidden [color:var(--mut)] text-[14px] leading-[1.5] whitespace-normal [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                        <HighlightMatch text={excerptFromMarkdown(it.body_md)} query={ideaQ} />
                      </p>
                      <div
                        className={`cm-idea-meta flex items-center gap-3 max-[521px]:gap-2 ${cmIdeaMeta}`}
                      >
                        <span className="cm-idea-author [&_.avatar-ring]:[background:var(--panel)] inline-flex items-center gap-2 min-w-0">
                          <AvatarRing
                            name={it.author_name}
                            avatarUrl={it.author_avatar}
                            size={28}
                            ringWidth={2}
                            ringOffset={2}
                            rank={rankFor(it.author_rating)}
                          />
                          <TierName name={it.author_name} solved={it.author_solved} />
                        </span>
                        <span className="[color:var(--dim)]">{relTime(it.created_at)}</span>
                        <div className={`cm-idea-tags flex items-center gap-1.5 ${cmIdeaTags}`}>
                          <span
                            className={`cm-idea-tag [border:1px_solid_var(--line2)] tracking-[0.05em] ${cmIdeaTag}`}
                          >
                            {ideaTypeLabel(it.type)}
                          </span>
                          <span
                            className={`cm-idea-tag [border:1px_solid_var(--line2)] tracking-[0.05em] [&.status-open]:border-acc [&.status-planned]:border-acc2 [&.status-shipped]:border-mut [&&&&.status-closed]:border-bad ${cmIdeaTag} status-${it.status}`}
                          >
                            {it.status}
                          </span>
                          {it.my_interest === 'accepted' && (
                            <span
                              className={`pill ok cm-idea-accepted-badge tracking-[0.06em] ${cmIdeaAcceptedBadge}`}
                            >
                              ✓ Accepted
                            </span>
                          )}
                        </div>
                        {mine && (
                          <span className="[border:1px_solid_var(--acc)] tracking-[0.05em] py-px px-1.5 inline-block [background:var(--acc)] text-on text-[11px] font-bold leading-[1.5] uppercase">
                            You
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="cm-idea-action [&_.btn.xs]:min-h-[32px] [&_.btn.xs]:p-[0_10px] [&_.btn.xs]:font-label [&_.btn.xs]:text-[12px] [&_.btn.xs]:tracking-[0.03em] flex items-end gap-2 pt-0.5 max-[769px]:items-start max-[769px]:pt-4 max-[769px]:[border-top:1px_solid_var(--line)] flex-col [@media(max-width:768px)]:mt-2 [@media(max-width:768px)]:w-full">
                      {mine ? (
                        <>
                          <span className="cm-idea-applicant-count font-label text-[11px] font-bold uppercase text-acc">
                            {it.interested_count} New Applicant
                            {it.interested_count === 1 ? '' : 's'}
                          </span>
                          <button
                            type="button"
                            className="btn xs cm-idea-manage text-on hover:text-bg"
                            onClick={(e) => {
                              e.stopPropagation();
                              setManageIdeaId(it.id);
                            }}
                          >
                            Manage Interested ({it.interested_count})
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className={`cm-idea-interested-label tracking-[0.05em] ${cmIdeaInterestedLabel}`}
                          >
                            Interested ({it.interested_count})
                          </span>
                          {it.my_interest === 'declined' && (
                            <span
                              className={`pill bad cm-idea-status-badge tracking-[0.06em] ${cmIdeaStatusBadge}`}
                            >
                              ✗ Declined
                            </span>
                          )}
                          {it.my_interest === 'pending' && (
                            <span
                              className={`pill warn cm-idea-status-badge tracking-[0.06em] ${cmIdeaStatusBadge}`}
                            >
                              Interest sent
                            </span>
                          )}
                          {!it.my_interest && !me.system && it.status !== 'closed' && (
                            <button
                              type="button"
                              className="btn xs cm-idea-card-join text-on hover:text-bg"
                              disabled={joiningIdeaId === it.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCardJoin(it);
                              }}
                            >
                              {joiningIdeaId === it.id
                                ? 'Joining…'
                                : it.roles.length > 0
                                  ? 'Apply to Join'
                                  : "I'm in"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div
            ref={ideaSentinelRef}
            className={`cm-sentinel p-[16px_0] ${cmSentinel}`}
            aria-live="polite"
          >
            {ideaLoading && ideaInitialized
              ? 'Loading more ideas…'
              : ideaCursor
                ? 'Scroll for more ideas'
                : ''}
          </div>
        </div>
      )}

      {/* ────────── TAB 4: POLLS ────────── */}
      {tab === 'Polls' && (
        <div className="bento">
          {canPoll && (
            <SaveForm
              className="panel stack [--g:14px]"

              label="Unpublished poll"
              saveLabel="Publish"
              onDiscard={resetPoll}
              onSubmit={handleCreatePoll}
            >
              <label className="field">
                <span className="label">Question</span>
                <input
                  className="input"
                  value={pollQ}
                  onChange={(e) => setPollQ(e.target.value)}
                  required
                  minLength={3}
                  maxLength={160}
                />
              </label>
              <label className="field">
                <span className="label">Options, one per line (2 to 8)</span>
                <textarea
                  className="input"
                  rows={4}
                  value={pollOpts}
                  onChange={(e) => setPollOpts(e.target.value)}
                  required
                />
              </label>
              <button className="btn sm self-start">Publish poll</button>
            </SaveForm>
          )}
          {polls.length === 0 && <p className="empty">No polls yet.</p>}
          {pollsShown.map((p) => {
            const mine = s.votes[p.id];
            const live = counts.votes[p.id] ?? {};
            const total = p.opts.reduce((a, o) => a + (live[o] ?? 0), 0);
            return (
              <section key={p.id} className="panel c6">
                <h2 className="h3">{p.q}</h2>
                {p.opts.map((o) => {
                  const pct = total ? Math.round(((live[o] ?? 0) / total) * 100) : 0;
                  return (
                    <button
                      key={o}
                      className="[display:grid] grid-cols-[minmax(0,1fr)_auto] gap-[6px_12px] w-full [background:none] [border:1px_solid_var(--line2)] p-[12px_14px] cursor-pointer text-left relative overflow-hidden hover:border-acc [&[aria-pressed='true']]:border-acc [&_i]:absolute [&_i]:inset-[0_auto_0_0] [&_i]:[background:color-mix(in_srgb,var(--acc)_22%,transparent)] [&_i]:z-0 [&_span]:relative focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px]"
                      aria-pressed={mine === o}
                      disabled={me.system}
                      onClick={() => act('vote', { poll: p.id, option: o })}
                    >
                      {mine && <i style={{ width: `${pct}%` }} />}
                      <span>
                        <b className="mono acc mr-2.5">{mine === o ? '●' : '○'}</b>
                        {o}
                      </span>
                      <span className="mono">{mine ? `${pct}%` : ''}</span>
                    </button>
                  );
                })}
                <div className="row between">
                  <p className="label">
                    {total} votes · {p.by} · {relTime(p.at)}
                    {mine ? '' : ' · vote to see results'}
                  </p>
                  {(canPoll || p.user_id === me.id) && (
                    <button
                      type="button"
                      className="btn xs line"
                      onClick={async () =>
                        (await sure(`Delete the poll "${p.q}" and its votes?`)) &&
                        act('deletePoll', { id: p.id })
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              </section>
            );
          })}
          {pollsMore}
        </div>
      )}

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
        onClose={() => {
          setActiveAnn(null);
          // Drop `open` so the effect above does not reopen it.
          if (openParam) router.replace('/app/community?tab=announcements', { scroll: false });
        }}
        onDelete={
          activeAnn?.id.startsWith('an:') &&
          (can(s.roles, 'announce.post') === true ||
            news.some((n) => n.id === activeAnn.id && n.user_id === me.id))
            ? async () => {
                const target = activeAnn;
                setActiveAnn(null);
                const confirmed = await sure(
                  'Delete this announcement for everyone?',
                  'This cannot be undone.',
                  'Delete',
                  true,
                );
                if (!confirmed) return;
                await act('deleteAnnouncement', { id: target.id });
              }
            : undefined
        }
      />

      <NewIdeaModal
        open={newIdeaOpen}
        onClose={() => setNewIdeaOpen(false)}
        onSubmit={handleCreateIdea}
      />

      <ManageInterestedModal
        ideaId={manageIdeaId}
        onClose={() => setManageIdeaId(null)}
        onMutated={() => fetchIdeas(null, false)}
        onOpenProfile={handleOpenProfile}
      />

      <JoinIdeaModal
        idea={joinIdea}
        onClose={() => setJoinIdea(null)}
        onSubmitted={() => fetchIdeas(null, false)}
      />

      <IdeaModal
        ideaId={activeIdeaId}
        onClose={() => setActiveIdeaId(null)}
        onMutated={() => fetchIdeas(null, false)}
        onManage={() => {
          if (activeIdeaId == null) return;
          setManageIdeaId(activeIdeaId);
          setActiveIdeaId(null);
        }}
      />

      {activeProfileId && (
        <ProfileModal userId={activeProfileId} onClose={handleCloseProfile} onMutated={() => {}} />
      )}
    </Page>
  );
}

// No Suspense boundary: see components/app/alumni/AlumniPage.tsx.
export default function Community({ initialFeed }: { initialFeed: FeedFirst | null }) {
  return <CommunityContent initialFeed={initialFeed} />;
}
