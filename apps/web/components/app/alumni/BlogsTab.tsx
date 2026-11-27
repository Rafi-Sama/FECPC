'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BlogCard } from './BlogCard';
import { BlogReader } from './BlogReader';
import { BlogEditor } from './BlogEditor';
import type { BlogPost } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { can } from '@fecpc/contracts';

import { filterChip, emptyPanel, listKicker } from '@/components/app/alumni/ui';

const blogAction =
  'btn py-0 px-4.5 [font:600_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink min-h-[44px] cursor-pointer w-full';

const TOPICS = [
  'All',
  'Career',
  'Interviews',
  'Engineering',
  'Stories',
  'Grad school',
  'Life abroad',
];

const TOP_CONTRIBUTORS = [
  { rank: 1, name: 'Shahriar Kabir', color: '#a85d00', votes: 148 },
  { rank: 2, name: 'Tahmina Akhter', color: '#0000FF', votes: 121 },
  { rank: 3, name: 'Nabila Karim', color: '#AA00AA', votes: 96 },
  { rank: 4, name: 'Asif Mahmud', color: '#027a72', votes: 74 },
  { rank: 5, name: 'Rifat Hasan', color: '#006400', votes: 52 },
];

/** The whole post, or null when it could not be loaded. */
async function loadPost(slug: string): Promise<BlogPost | null> {
  const res = await fetch('/api/alumni', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'getBlogPost', slug }),
  }).catch(() => null);
  return res?.ok ? ((await res.json()) as BlogPost) : null;
}

export function BlogsTab({
  searchQuery,
  activeReadSlug,
  onSelectReadSlug,
  onOpenProfile,
  onCountChange,
  onShowToast,
}: {
  searchQuery?: string;
  activeReadSlug?: string | null;
  onSelectReadSlug?: (slug: string | null) => void;
  onOpenProfile?: (id: string) => void;
  onCountChange?: (count: number) => void;
  onShowToast?: (msg: string) => void;
}) {
  const router = useRouter();
  const { s } = useStore();
  const canWrite = can(s.roles, 'blog.post.create') || s.role === 'alumni';

  const [q, setQ] = useState(searchQuery ?? '');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [sortOrder, setSortOrder] = useState<'latest' | 'top'>('latest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals
  const [activePost, setActivePost] = useState<BlogPost | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCountChangeRef = useRef(onCountChange);
  // The parent shows the count; tell it whenever the total changes, including after a delete.
  useEffect(() => {
    onCountChangeRef.current?.(total);
  }, [total]);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  // Sync external search query
  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== q) {
      setQ(searchQuery);
    }
  }, [searchQuery]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'listBlogPosts',
          q: q.trim() || undefined,
          tag: selectedTopic !== 'All' ? selectedTopic : undefined,
          sort: sortOrder,
          pageSize: 20,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load blog posts', err);
    } finally {
      setLoading(false);
    }
  }, [q, selectedTopic, sortOrder]);

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchPosts();
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [fetchPosts]);

  // The list holds the start of each post only; the reader shows the preview while the whole post loads.
  const opened = useRef('');
  const openFull = useCallback(async (post: BlogPost) => {
    if (opened.current === post.slug) return; // opened by the click, then again by the slug it set
    opened.current = post.slug;
    setActivePost(post);
    const full = await loadPost(post.slug);
    if (!full) return;
    setActivePost((cur) =>
      cur?.id === full.id ? { ...full, read_time_min: post.read_time_min } : cur,
    );
  }, []);

  // Open post if activeReadSlug provided
  useEffect(() => {
    if (activeReadSlug && posts.length > 0) {
      const found = posts.find((p) => p.slug === activeReadSlug);
      if (found) void openFull(found);
    } else if (!activeReadSlug) {
      opened.current = '';
      setActivePost(null);
    }
  }, [activeReadSlug, posts, openFull]);

  const handleOpenPost = (post: BlogPost) => {
    void openFull(post);
    onSelectReadSlug?.(post.slug);
  };

  const handleClosePost = () => {
    opened.current = '';
    setActivePost(null);
    onSelectReadSlug?.(null);
  };

  const handlePostSaved = () => {
    setEditorOpen(false);
    setEditingPost(null);
    onShowToast?.('Post published');
    fetchPosts();
  };

  const handlePostDeleted = (postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setTotal((prev) => Math.max(0, prev - 1));
    handleClosePost();
    onShowToast?.('Post deleted');
  };

  // The editor always gets the whole post: saving a list preview would cut the post short.
  const handleStartEdit = async (post: BlogPost) => {
    const full = await loadPost(post.slug);
    if (!full) return onShowToast?.('Could not load the post. Try again.');
    opened.current = '';
    setActivePost(null);
    setEditingPost(full);
    setEditorOpen(true);
  };

  const topWeekPosts = posts.slice(0, 3);

  return (
    <div className="blogs-tab-view">
      {/* Two Column Layout matching mockup 41f59af4 */}
      <div className="flex gap-8 items-start flex-wrap">
        {/* Left Column: Posts List */}
        <div className="flex-[1_1_560px] min-w-0">
          {/* Controls Bar */}
          <div className="mb-6 flex gap-3 flex-wrap items-center">
            {/* Search Input */}
            <div className="flex-[0_1_300px]">
              <input
                type="search"
                aria-label="Search posts"
                placeholder="Search posts"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="py-3 px-3.5 [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink text-[14px] min-h-[44px] w-full"
              />
            </div>

            {/* Filters Dropdown */}
            <div className="relative">
              <button
                type="button"
                className="py-2.5 px-3.5 [font:12px_ui-monospace,_Menlo,_monospace] uppercase tracking-[1px] [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink min-h-[44px] flex items-center cursor-pointer"
                onClick={() => setFiltersOpen((o) => !o)}
              >
                Filters ▾
              </button>

              {filtersOpen && (
                <div className="pn top-13 left-0 p-5 m-0 absolute w-[360px] z-[10] [background:var(--panel)] [border:2px_solid_var(--line2)] [box-shadow:6px_6px_0_var(--line2)]">
                  <div className="m mb-3 [font:11px_ui-monospace,_Menlo,_monospace] uppercase text-dim">
                    Topic
                  </div>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {TOPICS.slice(0, 5).map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => {
                          setSelectedTopic(topic);
                          setFiltersOpen(false);
                        }}
                        className="py-1.5 px-2.5 [font:12px_ui-monospace,_Menlo,_monospace] uppercase tracking-[1px] [border:2px_solid_var(--line2)] cursor-pointer"
                        style={{
                          background:
                            selectedTopic === topic
                              ? 'var(--acc, #1F3BFF)'
                              : 'var(--panel, #F6F4EE)',
                          color:
                            selectedTopic === topic ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                        }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>

                  <div className="f m-0">
                    <label
                      className="m mb-1.5 block [font:11px_ui-monospace,_Menlo,_monospace] uppercase text-dim"
                      htmlFor="bt"
                    >
                      Batch
                    </label>
                    <select
                      id="bt"
                      className="py-2.5 px-3 [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink text-[14px] w-full cursor-pointer"
                    >
                      <option>All batches</option>
                      <option>Batch 16</option>
                      <option>Batch 17</option>
                      <option>Batch 18</option>
                      <option>Batch 19</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Latest vs Top Segmented Toggle */}
            <div className="ty flex gap-2">
              <button
                type="button"
                className={`${sortOrder === 'latest' ? 'on' : ''} ${filterChip}`}
                onClick={() => setSortOrder('latest')}
                style={{
                  background:
                    sortOrder === 'latest' ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                  color: sortOrder === 'latest' ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                }}
              >
                Latest
              </button>
              <button
                type="button"
                className={`${sortOrder === 'top' ? 'on' : ''} ${filterChip}`}
                onClick={() => setSortOrder('top')}
                style={{
                  background: sortOrder === 'top' ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                  color: sortOrder === 'top' ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                }}
              >
                Top
              </button>
            </div>

            {/* Write post button CTA on top right */}
            {canWrite && (
              <div className="ml-auto flex-none">
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setEditingPost(null);
                    setEditorOpen(true);
                  }}
                >
                  + Write post
                </button>
              </div>
            )}
          </div>

          {/* Posts List */}
          {loading && posts.length === 0 ? (
            <div>
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="pn p-6 mb-6 [background:var(--panel)] [border:2px_solid_var(--line2)] opacity-[0.6]"
                >
                  <div className="mb-4 flex gap-3">
                    <div className="w-[40px] h-[40px] [background:var(--line)]" />
                    <div className="flex-1">
                      <div className="mb-3 h-[12px] [background:var(--line)] w-[40%]" />
                      <div className="h-[12px] [background:var(--line)] w-[25%]" />
                    </div>
                  </div>
                  <div className="mb-3 h-[16px] [background:var(--line)] w-[80%]" />
                  <div className="h-[14px] [background:var(--line)] w-[60%]" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className={emptyPanel}>
              <p className={listKicker}>No blog posts found matching your search.</p>
              {canWrite && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setEditingPost(null);
                    setEditorOpen(true);
                  }}
                >
                  Write the first post
                </button>
              )}
            </div>
          ) : (
            posts.map((p) => (
              <BlogCard key={p.id} post={p} onOpen={handleOpenPost} highlightQuery={q} />
            ))
          )}
        </div>

        {/* Right Sticky Sidebar matching mockup 41f59af4 */}
        <aside className="top-6 flex-[0_0_300px] [position:sticky]">
          {/* Top Contributors Box */}
          <div className="mb-6 [border:2px_solid_var(--line2)] [background:var(--panel)]">
            <div className="py-2.5 px-4 [background:var(--ink)]">
              <span className="m text-on text-[11px] font-bold uppercase">Top contributors</span>
            </div>

            <div className="pt-2 px-4 pb-4">
              <div className="m pt-2 px-0 pb-0 flex justify-between [font:11px_ui-monospace,_Menlo,_monospace] uppercase text-dim">
                <span>Alumni</span>
                <span>Votes</span>
              </div>

              {TOP_CONTRIBUTORS.map((c) => (
                <div
                  key={c.rank}
                  className="r py-2.5 px-0 flex items-center gap-3 [border-top:1px_solid_var(--line)]"
                >
                  <span className="m w-[16px] [font:11px_ui-monospace,_Menlo,_monospace] text-dim">
                    {c.rank}
                  </span>
                  <span
                    className="flex-1 font-semibold text-[14px] overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ color: c.color }}
                  >
                    {c.name}
                  </span>
                  <span className="mo [font:700_13px_ui-monospace,_Menlo,_monospace] text-ink">
                    {c.votes}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top This Week Box */}
          <div className="mb-6 [border:2px_solid_var(--line2)] [background:var(--panel)]">
            <div className="py-2.5 px-4 [background:var(--ink)]">
              <span className="m text-on text-[11px] font-bold uppercase">Top this week</span>
            </div>

            <div className="pt-2 px-4 pb-4">
              {topWeekPosts.length > 0 ? (
                topWeekPosts.map((p, idx) => (
                  <div
                    key={p.id}
                    className="r py-2.5 px-0 flex items-start gap-3 cursor-pointer"
                    onClick={() => handleOpenPost(p)}
                    style={{ borderTop: idx > 0 ? '1px solid var(--line, #cfcbbf)' : 0 }}
                  >
                    <span className="mo text-acc w-[44px] flex-none [font:700_13px_ui-monospace,_Menlo,_monospace]">
                      ▲ {p.upvotes || 31}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="[font:600_12px_ui-monospace,_Menlo,_monospace] text-acc overflow-hidden text-ellipsis whitespace-nowrap">
                        {p.author_name || 'Alumnus'}
                      </div>
                      <b className="mt-0.5 text-[14px] block overflow-hidden text-ellipsis whitespace-nowrap">
                        {p.title}
                      </b>
                    </div>
                  </div>
                ))
              ) : (
                <div className="m py-3 px-0 text-dim">No top posts yet this week.</div>
              )}
            </div>
          </div>

          {/* Topics Tag Chips Box */}
          <div className="mb-6 [border:2px_solid_var(--line2)] [background:var(--panel)]">
            <div className="py-2.5 px-4 [background:var(--ink)]">
              <span className="m text-on text-[11px] font-bold uppercase">Topics</span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {TOPICS.slice(1).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTopic(t)}
                    className="py-1 px-2 [font:11px_ui-monospace,_Menlo,_monospace] uppercase tracking-[.06em] [border:1px_solid_var(--line2)] cursor-pointer"
                    style={{
                      background:
                        selectedTopic === t ? 'var(--acc, #1F3BFF)' : 'var(--panel, #FFFFFF)',
                      color: selectedTopic === t ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Blue Callout Card */}
          <div className="p-6 [background:var(--acc)] text-on [border:2px_solid_var(--line2)]">
            <h3 className="mt-0 mx-0 mb-2 text-on text-[20px] font-bold">
              Share what you’ve learned
            </h3>
            <p className="t mb-4 text-on opacity-[0.9] text-[14px] leading-[1.5]">
              Alumni and admins can publish posts.
            </p>
            {canWrite ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className={blogAction}
                  onClick={() => {
                    setEditingPost(null);
                    setEditorOpen(true);
                  }}
                >
                  Write a post
                </button>
                <button
                  type="button"
                  className="btn py-0 px-4.5 [font:600_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--ink)] text-on min-h-[44px] cursor-pointer w-full"
                  onClick={() => router.push('/app/community?tab=feed')}
                >
                  Write in community feed →
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={blogAction}
                onClick={() => router.push('/app/community?tab=feed')}
              >
                Write a post →
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Blog Reader Modal */}
      {activePost && (
        <BlogReader
          post={activePost}
          onClose={handleClosePost}
          onEdit={handleStartEdit}
          onDelete={handlePostDeleted}
          onOpenProfile={onOpenProfile}
        />
      )}

      {/* Blog Editor Modal */}
      {editorOpen && (
        <BlogEditor
          post={editingPost}
          onClose={() => {
            setEditorOpen(false);
            setEditingPost(null);
          }}
          onSaved={handlePostSaved}
        />
      )}
    </div>
  );
}

export default BlogsTab;
