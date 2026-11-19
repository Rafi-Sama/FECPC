"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BlogCard } from "./BlogCard";
import { BlogReader } from "./BlogReader";
import { BlogEditor } from "./BlogEditor";
import type { BlogPost } from "@/lib/state";
import { useStore } from "@/components/app/Store";
import { can } from "@/lib/permissions";

const TOPICS = [
  "All",
  "Career",
  "Interviews",
  "Engineering",
  "Stories",
  "Grad school",
  "Life abroad",
];

const TOP_CONTRIBUTORS = [
  { rank: 1, name: "Shahriar Kabir", color: "#a85d00", votes: 148 },
  { rank: 2, name: "Tahmina Akhter", color: "#0000FF", votes: 121 },
  { rank: 3, name: "Nabila Karim", color: "#AA00AA", votes: 96 },
  { rank: 4, name: "Asif Mahmud", color: "#027a72", votes: 74 },
  { rank: 5, name: "Rifat Hasan", color: "#006400", votes: 52 },
];

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
  const canWrite = can(s.role, "blog.post.create") || s.role === "alumni";

  const [q, setQ] = useState(searchQuery ?? "");
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [sortOrder, setSortOrder] = useState<"latest" | "top">("latest");
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
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "listBlogPosts",
          q: q.trim() || undefined,
          tag: selectedTopic !== "All" ? selectedTopic : undefined,
          sort: sortOrder,
          pageSize: 20,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setTotal(data.total || 0);
        onCountChangeRef.current?.(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load blog posts", err);
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

  // Open post if activeReadSlug provided
  useEffect(() => {
    if (activeReadSlug && posts.length > 0) {
      const found = posts.find((p) => p.slug === activeReadSlug);
      if (found) setActivePost(found);
    } else if (!activeReadSlug) {
      setActivePost(null);
    }
  }, [activeReadSlug, posts]);

  const handleOpenPost = (post: BlogPost) => {
    setActivePost(post);
    onSelectReadSlug?.(post.slug);
  };

  const handleClosePost = () => {
    setActivePost(null);
    onSelectReadSlug?.(null);
  };

  const handlePostSaved = () => {
    setEditorOpen(false);
    setEditingPost(null);
    onShowToast?.("Post published");
    fetchPosts();
  };

  const handlePostDeleted = (postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setTotal((prev) => Math.max(0, prev - 1));
    handleClosePost();
    onShowToast?.("Post deleted");
  };

  const handleStartEdit = (post: BlogPost) => {
    setActivePost(null);
    setEditingPost(post);
    setEditorOpen(true);
  };

  const topWeekPosts = posts.slice(0, 3);

  return (
    <div className="blogs-tab-view">
      {/* Two Column Layout matching mockup 41f59af4 */}
      <div
        style={{
          display: "flex",
          gap: 32,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* Left Column: Posts List */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          {/* Controls Bar */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            {/* Search Input */}
            <div style={{ flex: "0 1 300px" }}>
              <input
                type="search"
                aria-label="Search posts"
                placeholder="Search posts"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{
                  border: "2px solid var(--line2, #0B0B0B)",
                  background: "var(--panel, #F6F4EE)",
                  color: "var(--ink, #0B0B0B)",
                  padding: "12px 14px",
                  fontSize: 14,
                  minHeight: 44,
                  width: "100%",
                }}
              />
            </div>

            {/* Filters Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="ch"
                onClick={() => setFiltersOpen((o) => !o)}
                style={{
                  font: "12px ui-monospace, Menlo, monospace",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  border: "2px solid var(--line2, #0B0B0B)",
                  padding: "10px 14px",
                  background: "var(--panel, #F6F4EE)",
                  color: "var(--ink, #0B0B0B)",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                Filters ▾
              </button>

              {filtersOpen && (
                <div
                  className="pn"
                  style={{
                    position: "absolute",
                    top: 52,
                    left: 0,
                    width: 360,
                    zIndex: 10,
                    margin: 0,
                    background: "var(--panel, #F6F4EE)",
                    border: "2px solid var(--line2, #0B0B0B)",
                    padding: 20,
                    boxShadow: "6px 6px 0 var(--line2, #0B0B0B)",
                  }}
                >
                  <div
                    className="m"
                    style={{
                      marginBottom: 12,
                      font: "11px ui-monospace, Menlo, monospace",
                      textTransform: "uppercase",
                      color: "var(--dim, #5F5F5F)",
                    }}
                  >
                    Topic
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {TOPICS.slice(0, 5).map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => {
                          setSelectedTopic(topic);
                          setFiltersOpen(false);
                        }}
                        style={{
                          font: "12px ui-monospace, Menlo, monospace",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          border: "2px solid var(--line2, #0B0B0B)",
                          padding: "6px 10px",
                          background: selectedTopic === topic ? "var(--acc, #1F3BFF)" : "var(--panel, #F6F4EE)",
                          color: selectedTopic === topic ? "var(--on, #FFFFFF)" : "var(--ink, #0B0B0B)",
                          cursor: "pointer",
                        }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>

                  <div className="f" style={{ margin: 0 }}>
                    <label
                      className="m"
                      htmlFor="bt"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        font: "11px ui-monospace, Menlo, monospace",
                        textTransform: "uppercase",
                        color: "var(--dim, #5F5F5F)",
                      }}
                    >
                      Batch
                    </label>
                    <select
                      id="bt"
                      style={{
                        border: "2px solid var(--line2, #0B0B0B)",
                        background: "var(--panel, #F6F4EE)",
                        color: "var(--ink, #0B0B0B)",
                        padding: "10px 12px",
                        fontSize: 14,
                        width: "100%",
                        cursor: "pointer",
                      }}
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
            <div className="ty" style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`ch ${sortOrder === "latest" ? "on" : ""}`}
                onClick={() => setSortOrder("latest")}
                style={{
                  font: "12px ui-monospace, Menlo, monospace",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  border: "2px solid var(--line2, #0B0B0B)",
                  padding: "10px 14px",
                  background: sortOrder === "latest" ? "var(--acc, #1F3BFF)" : "var(--panel, #F6F4EE)",
                  color: sortOrder === "latest" ? "var(--on, #FFFFFF)" : "var(--ink, #0B0B0B)",
                  minHeight: 44,
                  cursor: "pointer",
                }}
              >
                Latest
              </button>
              <button
                type="button"
                className={`ch ${sortOrder === "top" ? "on" : ""}`}
                onClick={() => setSortOrder("top")}
                style={{
                  font: "12px ui-monospace, Menlo, monospace",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  border: "2px solid var(--line2, #0B0B0B)",
                  padding: "10px 14px",
                  background: sortOrder === "top" ? "var(--acc, #1F3BFF)" : "var(--panel, #F6F4EE)",
                  color: sortOrder === "top" ? "var(--on, #FFFFFF)" : "var(--ink, #0B0B0B)",
                  minHeight: 44,
                  cursor: "pointer",
                }}
              >
                Top
              </button>
            </div>

            {/* Write post button CTA on top right */}
            {canWrite && (
              <div style={{ marginLeft: "auto" }}>
                <button
                  type="button"
                  className="btn k"
                  onClick={() => {
                    setEditingPost(null);
                    setEditorOpen(true);
                  }}
                  style={{
                    font: "600 13px Inter, Arial, sans-serif",
                    border: "2px solid var(--line2, #0B0B0B)",
                    padding: "0 18px",
                    background: "var(--ink, #0B0B0B)",
                    color: "var(--on, #FFFFFF)",
                    minHeight: 44,
                    cursor: "pointer",
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
                  className="pn"
                  style={{
                    padding: 24,
                    background: "var(--panel, #F6F4EE)",
                    border: "2px solid var(--line2, #0B0B0B)",
                    marginBottom: 24,
                    opacity: 0.6,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, background: "var(--line, #DAD6CB)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 12, background: "var(--line, #DAD6CB)", marginBottom: 12, width: "40%" }} />
                      <div style={{ height: 12, background: "var(--line, #DAD6CB)", width: "25%" }} />
                    </div>
                  </div>
                  <div style={{ height: 16, background: "var(--line, #DAD6CB)", marginBottom: 12, width: "80%" }} />
                  <div style={{ height: 14, background: "var(--line, #DAD6CB)", width: "60%" }} />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div
              className="pn"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                background: "var(--panel, #F6F4EE)",
                border: "2px solid var(--line2, #0B0B0B)",
              }}
            >
              <p
                className="m"
                style={{
                  font: "11px ui-monospace, Menlo, monospace",
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--dim, #5F5F5F)",
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                No blog posts found matching your search.
              </p>
              {canWrite && (
                <button
                  type="button"
                  className="btn k"
                  onClick={() => {
                    setEditingPost(null);
                    setEditorOpen(true);
                  }}
                  style={{
                    font: "600 13px Inter, Arial, sans-serif",
                    border: "2px solid var(--line2, #0B0B0B)",
                    padding: "0 18px",
                    background: "var(--ink, #0B0B0B)",
                    color: "var(--on, #FFFFFF)",
                    minHeight: 44,
                    cursor: "pointer",
                  }}
                >
                  Write the first post
                </button>
              )}
            </div>
          ) : (
            posts.map((p) => (
              <BlogCard
                key={p.id}
                post={p}
                onOpen={handleOpenPost}
                highlightQuery={q}
              />
            ))
          )}
        </div>

        {/* Right Sticky Sidebar matching mockup 41f59af4 */}
        <aside style={{ flex: "0 0 300px", position: "sticky", top: 24 }}>
          {/* Top Contributors Box */}
          <div
            style={{
              border: "2px solid var(--line2, #0B0B0B)",
              background: "var(--panel, #F6F4EE)",
              marginBottom: 24,
            }}
          >
            <div style={{ background: "var(--ink, #0B0B0B)", padding: "10px 16px" }}>
              <span
                className="m"
                style={{ color: "var(--on, #FFFFFF)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}
              >
                Top contributors
              </span>
            </div>

            <div style={{ padding: "8px 16px 16px" }}>
              <div
                className="m"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0 0",
                  font: "11px ui-monospace, Menlo, monospace",
                  textTransform: "uppercase",
                  color: "var(--dim, #5F5F5F)",
                }}
              >
                <span>Alumni</span>
                <span>Votes</span>
              </div>

              {TOP_CONTRIBUTORS.map((c) => (
                <div
                  key={c.rank}
                  className="r"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px solid var(--line, #cfcbbf)",
                  }}
                >
                  <span
                    className="m"
                    style={{ width: 16, font: "11px ui-monospace, Menlo, monospace", color: "var(--dim, #5F5F5F)" }}
                  >
                    {c.rank}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontWeight: 600,
                      fontSize: 14,
                      color: c.color,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    className="mo"
                    style={{ font: "13px ui-monospace, Menlo, monospace", fontWeight: 700, color: "var(--ink, #0B0B0B)" }}
                  >
                    {c.votes}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top This Week Box */}
          <div
            style={{
              border: "2px solid var(--line2, #0B0B0B)",
              background: "var(--panel, #F6F4EE)",
              marginBottom: 24,
            }}
          >
            <div style={{ background: "var(--ink, #0B0B0B)", padding: "10px 16px" }}>
              <span
                className="m"
                style={{ color: "var(--on, #FFFFFF)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}
              >
                Top this week
              </span>
            </div>

            <div style={{ padding: "8px 16px 16px" }}>
              {topWeekPosts.length > 0 ? (
                topWeekPosts.map((p, idx) => (
                  <div
                    key={p.id}
                    className="r"
                    onClick={() => handleOpenPost(p)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "10px 0",
                      borderTop: idx > 0 ? "1px solid var(--line, #cfcbbf)" : 0,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className="mo"
                      style={{
                        color: "var(--acc, #1F3BFF)",
                        width: 44,
                        flex: "none",
                        font: "13px ui-monospace, Menlo, monospace",
                        fontWeight: 700,
                      }}
                    >
                      ▲ {p.upvotes || 31}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          font: "600 12px ui-monospace, Menlo, monospace",
                          color: "var(--acc, #1F3BFF)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.author_name || "Alumnus"}
                      </div>
                      <b
                        style={{
                          fontSize: 14,
                          display: "block",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.title}
                      </b>
                    </div>
                  </div>
                ))
              ) : (
                <div className="m" style={{ padding: "12px 0", color: "var(--dim, #5F5F5F)" }}>
                  No top posts yet this week.
                </div>
              )}
            </div>
          </div>

          {/* Topics Tag Chips Box */}
          <div
            style={{
              border: "2px solid var(--line2, #0B0B0B)",
              background: "var(--panel, #F6F4EE)",
              marginBottom: 24,
            }}
          >
            <div style={{ background: "var(--ink, #0B0B0B)", padding: "10px 16px" }}>
              <span
                className="m"
                style={{ color: "var(--on, #FFFFFF)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}
              >
                Topics
              </span>
            </div>
            <div style={{ padding: "16px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TOPICS.slice(1).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTopic(t)}
                    style={{
                      font: "11px ui-monospace, Menlo, monospace",
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      border: "1px solid var(--line2, #0B0B0B)",
                      padding: "4px 8px",
                      background: selectedTopic === t ? "var(--acc, #1F3BFF)" : "var(--panel, #FFFFFF)",
                      color: selectedTopic === t ? "var(--on, #FFFFFF)" : "var(--ink, #0B0B0B)",
                      cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Blue Callout Card */}
          <div
            style={{
              background: "var(--acc, #1F3BFF)",
              color: "var(--on, #FFFFFF)",
              border: "2px solid var(--line2, #0B0B0B)",
              padding: 24,
            }}
          >
            <h3 style={{ color: "var(--on, #FFFFFF)", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
              Share what you’ve learned
            </h3>
            <p
              className="t"
              style={{
                color: "var(--on, #DCE1FF)",
                opacity: 0.9,
                marginBottom: 16,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              Alumni and admins can publish posts.
            </p>
            {canWrite ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditingPost(null);
                    setEditorOpen(true);
                  }}
                  style={{
                    font: "600 13px Inter, Arial, sans-serif",
                    border: "2px solid var(--line2, #0B0B0B)",
                    padding: "0 18px",
                    background: "var(--panel, #F6F4EE)",
                    color: "var(--ink, #0B0B0B)",
                    minHeight: 44,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Write a post
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => router.push("/app/community?tab=feed")}
                  style={{
                    font: "600 13px Inter, Arial, sans-serif",
                    border: "2px solid var(--line2, #0B0B0B)",
                    padding: "0 18px",
                    background: "var(--ink, #0B0B0B)",
                    color: "var(--on, #FFFFFF)",
                    minHeight: 44,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Write in community feed →
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => router.push("/app/community?tab=feed")}
                style={{
                  font: "600 13px Inter, Arial, sans-serif",
                  border: "2px solid var(--line2, #0B0B0B)",
                  padding: "0 18px",
                  background: "var(--panel, #F6F4EE)",
                  color: "var(--ink, #0B0B0B)",
                  minHeight: 44,
                  cursor: "pointer",
                  width: "100%",
                }}
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
