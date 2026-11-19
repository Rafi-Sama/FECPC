"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/app/Store";
import { MarkdownBody, MarkdownEditor, relTime } from "@/components/app/shared/MarkdownEditor";
import { TierAvatar, TierName } from "@/components/app/shared/TierBadge";
import { ideaTypeLabel } from "@/components/app/ideas/NewIdeaModal";
import { canFully } from "@/lib/permissions";
import type { IdeaDetail, IdeaStatus } from "@/lib/state";

export function IdeaModal({
  ideaId,
  onClose,
  onMutated,
}: {
  ideaId: number | null;
  onClose: () => void;
  onMutated: () => void;
}) {
  const { s, me, act } = useStore();
  const [detail, setDetail] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showApplySheet, setShowApplySheet] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editStatus, setEditStatus] = useState<IdeaStatus>("open");
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "getIdeaDetail", ideaId: id }),
      });
      if (res.ok) {
        const data = (await res.json()) as IdeaDetail;
        setDetail(data);
        setEditTitle(data.title);
        setEditBody(data.body_md);
        setEditStatus(data.status);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ideaId) {
      setDetail(null);
      setShowApplySheet(false);
      setAnswers({});
      setEditing(false);
      return;
    }
    setShowApplySheet(false);
    setAnswers({});
    setEditing(false);
    load(ideaId);
  }, [ideaId, load]);

  useEffect(() => {
    if (!ideaId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [ideaId, onClose]);

  if (!ideaId) return null;

  const isPoster = detail ? detail.user_id === me.id : false;
  const canManage = detail ? isPoster || canFully(s.role, "idea.manage") : false;
  const upvoted = detail ? s.kudos.includes(`idea:${detail.id}`) : false;

  const handleUpvote = async () => {
    if (!detail) return;
    const ok = await act("toggle", { list: "kudos", id: `idea:${detail.id}` });
    if (ok) {
      await load(detail.id);
      onMutated();
    }
  };

  const handleImInClick = async () => {
    if (!detail || busy || isPoster || detail.status === "closed") return;
    if (detail.roles.length > 0 && !showApplySheet) {
      setShowApplySheet(true);
      return;
    }
    setBusy(true);
    const ok = await act("expressInterest", { ideaId: detail.id, response: answers });
    setBusy(false);
    if (ok) {
      setShowApplySheet(false);
      setAnswers({});
      await load(detail.id);
      onMutated();
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || busy) return;
    setBusy(true);
    const ok = await act("expressInterest", { ideaId: detail.id, response: answers });
    setBusy(false);
    if (ok) {
      setShowApplySheet(false);
      setAnswers({});
      await load(detail.id);
      onMutated();
    }
  };

  const handleDecision = async (userId: string, decision: "accepted" | "declined") => {
    if (!detail || busy) return;
    setBusy(true);
    const ok = await act("decideInterest", { ideaId: detail.id, userId, decision });
    setBusy(false);
    if (ok) {
      await load(detail.id);
      onMutated();
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || busy) return;
    setBusy(true);
    const ok = await act("updateIdea", {
      ideaId: detail.id,
      title: editTitle.trim(),
      body_md: editBody.trim(),
      status: editStatus,
    });
    setBusy(false);
    if (ok) {
      setEditing(false);
      await load(detail.id);
      onMutated();
    }
  };

  const handleClosePost = async () => {
    if (!detail || busy) return;
    if (!confirm("Close this post? Members will no longer be able to express interest.")) return;
    setBusy(true);
    const ok = await act("closeIdea", { ideaId: detail.id });
    setBusy(false);
    if (ok) {
      await load(detail.id);
      onMutated();
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || busy || !commentText.trim()) return;
    setBusy(true);
    const ok = await act("comment", { targetType: "idea", targetId: detail.id, body: commentText.trim() });
    setBusy(false);
    if (ok) {
      setCommentText("");
      await load(detail.id);
      onMutated();
    }
  };

  return (
    <div className="cm-backdrop" role="dialog" aria-modal="true" aria-label={detail?.title ?? "Idea"} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cm-modal wide">
        {loading && !detail ? (
          <p className="body">Loading…</p>
        ) : detail ? (
          <>
            <header className="cm-modal-head">
              <TierAvatar name={detail.author_name} solved={detail.author_solved} avatarUrl={detail.author_avatar} size={36} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="cm-meta">
                  <TierName name={detail.author_name} solved={detail.author_solved} />
                  <span>· {relTime(detail.created_at)}</span>
                  <span className="pill" style={{ fontSize: 11, padding: "1px 6px" }}>
                    {ideaTypeLabel(detail.type)}
                  </span>
                  <span className={`pill ${detail.status === "shipped" ? "ok" : detail.status === "closed" ? "bad" : ""}`} style={{ fontSize: 11, padding: "1px 6px" }}>
                    {detail.status}
                  </span>
                </div>
              </div>
              <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
                ×
              </button>
            </header>

            {editing ? (
              <form className="stack" style={{ "--g": "14px" } as React.CSSProperties} onSubmit={handleSaveEdit}>
                <label className="field">
                  <span className="label">Title</span>
                  <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required minLength={3} maxLength={160} />
                </label>
                <MarkdownEditor
                  id="edit-idea-body"
                  label="Description (Markdown)"
                  value={editBody}
                  onChange={setEditBody}
                  required
                  minLength={3}
                  maxLength={10000}
                  rows={6}
                />
                <label className="field" style={{ maxWidth: 220 }}>
                  <span className="label">Status</span>
                  <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value as IdeaStatus)}>
                    <option value="open">Open</option>
                    <option value="planned">Planned</option>
                    <option value="shipped">Shipped</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <div className="row" style={{ "--g": "8px" } as React.CSSProperties}>
                  <button type="submit" className="btn sm" disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="btn sm line" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2 className="h2" style={{ fontSize: "clamp(22px, 2.5vw, 30px)" }}>
                  {detail.title}
                </h2>
                <hr className="rule" />
                <MarkdownBody markdown={detail.body_md} />
                {detail.roles.length > 0 && (
                  <div className="cm-side-box" style={{ gap: 8 }}>
                    <p className="label">Open roles / applicant questions</p>
                    <ul style={{ listStyle: "disc", paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      {detail.roles.map((r, i) => (
                        <li key={i} className="body" style={{ fontSize: 14 }}>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <hr className="rule" />

            {/* Action bar */}
            <div className="row between" style={{ "--g": "10px" } as React.CSSProperties}>
              <div className="row" style={{ "--g": "8px" } as React.CSSProperties}>
                <button
                  type="button"
                  className={`btn xs ${upvoted ? "" : "line"}`}
                  aria-pressed={upvoted}
                  onClick={handleUpvote}
                >
                  ▲ {detail.upvotes}
                </button>
                <span className="cm-inert-pill">💬 {detail.comments.length}</span>
                <span className="cm-inert-pill">Interested ({detail.interested_count})</span>
              </div>

              <div className="row" style={{ "--g": "8px" } as React.CSSProperties}>
                {canManage && !editing && (
                  <>
                    <button type="button" className="btn xs line" onClick={() => setEditing(true)} disabled={busy}>
                      Edit
                    </button>
                    {detail.status !== "closed" && (
                      <button type="button" className="btn xs line" onClick={handleClosePost} disabled={busy}>
                        Close post
                      </button>
                    )}
                  </>
                )}

                {/* I'M IN button: strictly hidden for poster */}
                {!isPoster && !me.system && detail.status !== "closed" && (
                  detail.my_interest ? (
                    <span
                      className={`pill ${
                        detail.my_interest === "accepted" ? "ok" : detail.my_interest === "declined" ? "bad" : "warn"
                      }`}
                    >
                      {detail.my_interest === "accepted"
                        ? "Accepted ✓"
                        : detail.my_interest === "declined"
                          ? "Declined"
                          : "Interest sent"}
                    </span>
                  ) : (
                    <button type="button" className="btn sm" disabled={busy} onClick={handleImInClick}>
                      I&apos;m in
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Inline application sheet when poster configured open roles */}
            {!isPoster && showApplySheet && detail.roles.length > 0 && (
              <form className="cm-interest-panel" onSubmit={handleApplySubmit}>
                <p className="label">Answer before joining · visible only to {detail.author_name}</p>
                {detail.roles.map((promptText, idx) => (
                  <label key={idx} className="field">
                    <span className="label">{promptText}</span>
                    <input
                      className="input"
                      required
                      maxLength={500}
                      value={answers[promptText] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [promptText]: e.target.value }))}
                      placeholder="Your answer"
                    />
                  </label>
                ))}
                <div className="row" style={{ justifyContent: "flex-end", "--g": "8px" } as React.CSSProperties}>
                  <button type="button" className="btn xs line" onClick={() => setShowApplySheet(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn xs" disabled={busy}>
                    {busy ? "Sending…" : "Send I'm in"}
                  </button>
                </div>
              </form>
            )}

            {/* POSTER-ONLY Interested panel: absent from server payload AND absent from DOM for non-posters */}
            {isPoster && Array.isArray(detail.interested) && (
              <section className="cm-interest-panel" aria-label="Interested members">
                <div className="row between">
                  <p className="label">Interested ({detail.interested.length}) · visible only to you</p>
                  {detail.accepted_count > 0 && <span className="pill ok">{detail.accepted_count} accepted</span>}
                </div>
                {detail.interested.length === 0 ? (
                  <p className="body">No one has expressed interest yet.</p>
                ) : (
                  <div className="list">
                    {detail.interested.map((row) => {
                      const entries = Object.entries(row.response ?? {});
                      return (
                        <div key={row.user_id} style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                          <TierAvatar name={row.name} solved={row.problems_solved} avatarUrl={row.avatar_url} size={36} />
                          <div className="grow">
                            <div className="row" style={{ "--g": "8px" } as React.CSSProperties}>
                              <TierName name={row.name} solved={row.problems_solved} />
                              <span className="label">rating {row.rating}</span>
                            </div>
                            {entries.length > 0 && (
                              <div className="stack" style={{ "--g": "4px", marginTop: 6 } as React.CSSProperties}>
                                {entries.map(([q, ans]) => (
                                  <p key={q} className="body" style={{ fontSize: 13 }}>
                                    <strong>{q}:</strong> {ans}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          {row.status === "pending" ? (
                            <div className="row" style={{ "--g": "6px", flexWrap: "nowrap" } as React.CSSProperties}>
                              <button
                                type="button"
                                className="btn xs"
                                disabled={busy}
                                onClick={() => handleDecision(row.user_id, "accepted")}
                              >
                                ✓ Accept
                              </button>
                              <button
                                type="button"
                                className="btn xs line"
                                disabled={busy}
                                onClick={() => handleDecision(row.user_id, "declined")}
                              >
                                ✗ Decline
                              </button>
                            </div>
                          ) : (
                            <span className={`pill ${row.status === "accepted" ? "ok" : "bad"}`}>{row.status}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Comments */}
            <div className="cm-comments">
              <p className="label">Comments · {detail.comments.length}</p>
              {detail.comments.length === 0 ? (
                <p className="body">No comments yet.</p>
              ) : (
                <div className="list">
                  {detail.comments.map((c) => (
                    <div key={c.id} style={{ alignItems: "flex-start" }}>
                      <TierAvatar name={c.author_name} solved={c.author_solved} avatarUrl={c.author_avatar} size={28} />
                      <div className="grow">
                        <div className="cm-meta" style={{ marginBottom: 4 }}>
                          <TierName name={c.author_name} solved={c.author_solved} />
                          <span>· {relTime(c.created_at)}</span>
                        </div>
                        <MarkdownBody markdown={c.body} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!me.system && (
                <form className="row" style={{ "--g": "8px", alignItems: "stretch" } as React.CSSProperties} onSubmit={handleComment}>
                  <input
                    className="input grow"
                    style={{ minHeight: 42 }}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    maxLength={2000}
                    aria-label="Add a comment"
                  />
                  <button type="submit" className="btn sm" disabled={busy || !commentText.trim()}>
                    Reply
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="stack">
            <div className="cm-modal-head">
              <strong>Idea not found</strong>
              <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
                ×
              </button>
            </div>
            <p className="body">This post may have been removed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default IdeaModal;
