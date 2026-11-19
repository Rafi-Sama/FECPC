"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AvatarRing, TierBadge } from "@/components/app/TierBadge";
import { useStore } from "@/components/app/Store";
import { rankFor } from "@/lib/rank";
import type { MemberProfile } from "@/lib/state";
import { AdminMenu } from "./AdminMenu";
import { AlumniSection } from "./AlumniSection";
import { ProfileEditMode } from "./ProfileEditMode";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ProfileModal({
  userId,
  onClose,
  onMutated,
}: {
  userId: string;
  onClose: () => void;
  onMutated: () => Promise<void> | void;
}) {
  const { s, me, act } = useStore();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);
  const [pingNote, setPingNote] = useState("");
  const [pingBusy, setPingBusy] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "getMemberProfile", userId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Could not load member profile.");
        setProfile(null);
        return;
      }
      const data = (await res.json()) as MemberProfile;
      setProfile(data);
    } catch {
      setError("Network error while loading profile.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setEditing(false);
    setPingOpen(false);
    setCopied(false);
    void loadProfile();
  }, [loadProfile]);

  // Body scroll lock while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Initial focus to close button (×) and focus trap + Esc close
  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;

      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null && !el.classList.contains("sr")
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modalRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isOwner = me.id === userId;
  const kudosId = `member:${userId}`;
  const hasKudos = s.kudos.includes(kudosId);
  const alreadyPinged = s.sent.some((x) => x.startsWith(`${userId}:team:`));

  const rank = profile ? rankFor(profile.problems_solved, profile.cf_handle) : rankFor(null);
  const roleLabel = profile ? profile.role || (profile.is_alumni ? "Alumni" : "Member") : "";

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  };

  const handleSendPing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPingBusy(true);
    try {
      const refSlug = pingNote
        .trim()
        .replace(/[^a-zA-Z0-9:.&' /+#-]/g, "")
        .slice(0, 60);
      const ok = await act("ping", { kind: "team", to: userId, ref: refSlug || "profile" });
      if (ok) {
        setPingOpen(false);
        setPingNote("");
      }
    } finally {
      setPingBusy(false);
    }
  };

  const statRating = profile && typeof profile.cf_rating === "number" && profile.cf_rating > 0 ? String(profile.cf_rating) : null;
  const statSolved = profile && !rank.unrated ? String(profile.problems_solved) : null;
  const statStreak = profile && profile.current_streak > 0 ? `${profile.current_streak}d` : null;
  const statContests = profile && profile.contests_participated > 0 ? String(profile.contests_participated) : null;

  return (
    <div
      className="profile-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label={profile ? `${profile.name} profile` : "Member profile"}
        style={
          {
            "--rank-color": rank.color,
            "--rank-text": rank.textColor,
          } as CSSProperties
        }
      >
        {/* Sticky header: close button is first focusable element */}
        <header className="profile-modal__topbar">
          <div className="row" style={{ "--g": "10px" } as React.CSSProperties}>
            <span className="label" style={{ fontSize: 12 }}>
              {editing ? "Edit profile" : profile ? `Member · FEC-${String(profile.no).padStart(4, "0")}` : "Member profile"}
            </span>
          </div>
          <div className="row" style={{ "--g": "8px" } as React.CSSProperties}>
            <button
              ref={closeBtnRef}
              type="button"
              className="profile-modal__close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        {/* Scrollable two-column resume body */}
        <div className="profile-modal__scroll">
          {loading && !profile ? (
            <div style={{ gridColumn: "1 / -1", padding: 32 }}>
              <p className="label">Loading profile…</p>
            </div>
          ) : error || !profile ? (
            <div style={{ gridColumn: "1 / -1", padding: 32 }}>
              <p className="body bad">{error || "Member not found."}</p>
            </div>
          ) : (
            <>
              {/* Left identity column (320px on desktop) */}
              <aside className="profile-modal__left">
                {editing && isOwner ? (
                  <ProfileEditMode
                    profile={profile}
                    formId="profile-edit-form"
                    onCancel={() => setEditing(false)}
                    onBusyChange={setEditBusy}
                    onSaved={async () => {
                      setEditing(false);
                      await loadProfile();
                      await onMutated();
                    }}
                  />
                ) : (
                  <>
                    <div>
                      <AvatarRing
                        name={profile.name}
                        solved={profile.problems_solved}
                        cfHandle={profile.cf_handle}
                        avatarUrl={profile.avatar_url}
                        size={96}
                        ringWidth={3}
                        ringOffset={4}
                        notched
                        rank={rank}
                      />
                    </div>

                    <div>
                      <h2 className="profile-modal__name">{profile.name}</h2>
                      <div className="member-card__meta-row" style={{ marginTop: 6, flexWrap: "wrap" }}>
                        <span className="label" style={{ fontSize: 12 }}>
                          {roleLabel} · {profile.dept} · Batch {profile.batch}
                        </span>
                        {profile.is_alumni && <span className="alumni-tag">ALUMNI</span>}
                      </div>
                    </div>

                    {!rank.unrated && (
                      <div>
                        <TierBadge
                          solved={profile.problems_solved}
                          rating={profile.cf_rating}
                          cfHandle={profile.cf_handle}
                          size="md"
                          rank={rank}
                        />
                      </div>
                    )}

                    <div className="profile-modal__links" aria-label="External profiles">
                      {profile.cf_handle ? (
                        <a
                          href={`https://codeforces.com/profile/${encodeURIComponent(profile.cf_handle)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="profile-modal__link"
                        >
                          CF: {profile.cf_handle} ↗
                        </a>
                      ) : (
                        <span className="profile-modal__link--missing">CF handle · —</span>
                      )}

                      {profile.github_url ? (
                        <a
                          href={profile.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="profile-modal__link"
                        >
                          GitHub ↗
                        </a>
                      ) : (
                        <span className="profile-modal__link--missing">GitHub · —</span>
                      )}

                      {profile.linkedin_url ? (
                        <a
                          href={profile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="profile-modal__link"
                        >
                          LinkedIn ↗
                        </a>
                      ) : (
                        <span className="profile-modal__link--missing">LinkedIn · —</span>
                      )}
                    </div>

                    {pingOpen && !isOwner && (
                      <form className="profile-modal__ping-box" onSubmit={handleSendPing}>
                        <span className="label" style={{ fontSize: 11 }}>
                          Ping · {profile.name}
                        </span>
                        <input
                          className="member-filter-ctrl"
                          value={pingNote}
                          onChange={(e) => setPingNote(e.target.value)}
                          placeholder="Short topic (optional)"
                          maxLength={60}
                          aria-label="Ping note"
                        />
                        <div className="row" style={{ "--g": "6px", justifyContent: "flex-end" } as React.CSSProperties}>
                          <button type="button" className="btn xs line" onClick={() => setPingOpen(false)}>
                            Cancel
                          </button>
                          <button type="submit" className="btn xs" disabled={pingBusy}>
                            {pingBusy ? "Sending…" : "Send"}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </aside>

              {/* Right resume column */}
              <div className="profile-modal__right">
                {/* 4-block stats band */}
                <div className="stats-band" aria-label="Member statistics">
                  <div className="stat-block" aria-label={`Rating: ${statRating ?? "none"}`}>
                    <span className={`stat-block__val${statRating ? "" : " stat-block__val--empty"}`}>
                      {statRating ?? "—"}
                    </span>
                    <span className="stat-block__label">Rating</span>
                  </div>
                  <div className="stat-block" aria-label={`Solved: ${statSolved ?? "none"}`}>
                    <span className={`stat-block__val${statSolved ? "" : " stat-block__val--empty"}`}>
                      {statSolved ?? "—"}
                    </span>
                    <span className="stat-block__label">Solved</span>
                  </div>
                  <div className="stat-block" aria-label={`Streak: ${statStreak ?? "none"}`}>
                    <span className={`stat-block__val${statStreak ? "" : " stat-block__val--empty"}`}>
                      {statStreak ?? "—"}
                    </span>
                    <span className="stat-block__label">Streak</span>
                  </div>
                  <div className="stat-block" aria-label={`Contests: ${statContests ?? "none"}`}>
                    <span className={`stat-block__val${statContests ? "" : " stat-block__val--empty"}`}>
                      {statContests ?? "—"}
                    </span>
                    <span className="stat-block__label">Contests</span>
                  </div>
                </div>

                {/* · ABOUT */}
                <section className="profile-section" aria-label="About">
                  <div className="profile-section__head">
                    <h3 className="profile-section__label">· About</h3>
                  </div>
                  {profile.bio ? (
                    <p className="profile-bio">{profile.bio}</p>
                  ) : (
                    <p className="profile-empty-dash">—</p>
                  )}
                </section>

                {/* Alumni-only sections above the fold when role = 'alumni' */}
                {profile.is_alumni && (
                  <AlumniSection profile={profile} onReload={loadProfile} />
                )}

                {/* · SKILLS */}
                <section className="profile-section" aria-label="Skills">
                  <div className="profile-section__head">
                    <h3 className="profile-section__label">· Skills</h3>
                  </div>
                  {profile.skills.length > 0 ? (
                    <div className="profile-skills-wrap">
                      {profile.skills.map((sk) => (
                        <span key={sk} className="tag">
                          {sk}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="profile-empty-dash">—</p>
                  )}
                </section>

                {/* · EXPERIENCE */}
                <section className="profile-section" aria-label="Experience">
                  <div className="profile-section__head">
                    <h3 className="profile-section__label">· Experience</h3>
                  </div>
                  {profile.experience.length > 0 ? (
                    <ol className="timeline">
                      {profile.experience.map((exp, idx) => (
                        <li key={`${exp.period}-${exp.role}-${idx}`} className="timeline__item">
                          <div className="timeline__rail" aria-hidden>
                            <i className="timeline__dot" />
                            <i className="timeline__line" />
                          </div>
                          <div className="timeline__body">
                            <span className="label" style={{ fontSize: 11 }}>
                              {exp.period}
                            </span>
                            <strong className="timeline__role">{exp.role}</strong>
                            {exp.summary && (
                              <p className="profile-bio" style={{ fontSize: 14 }}>
                                {exp.summary}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="profile-empty-dash">—</p>
                  )}
                </section>

                {/* · CONTEST HISTORY */}
                <section className="profile-section" aria-label="Contest history">
                  <div className="profile-section__head">
                    <h3 className="profile-section__label">· Contest history</h3>
                  </div>
                  {profile.contest_history.length > 0 ? (
                    <div>
                      <div className="contest-head">
                        <span className="grow">Contest</span>
                        <span>Rank</span>
                        <span style={{ width: 52, textAlign: "right" }}>Δ</span>
                      </div>
                      <ul className="list">
                        {profile.contest_history.slice(0, 10).map((c, idx) => (
                          <li key={`${c.name}-${idx}`}>
                            <span className="grow">{c.name}</span>
                            <span className="mono" style={{ fontSize: 13 }}>
                              #{c.rank}
                            </span>
                            <span
                              className={`mono ${c.delta >= 0 ? "contest-delta-pos" : "contest-delta-neg"}`}
                              style={{ fontSize: 13, width: 52, textAlign: "right" }}
                            >
                              {c.delta >= 0 ? `+${c.delta}` : `−${Math.abs(c.delta)}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="profile-empty-dash">—</p>
                  )}
                </section>

                {/* · RECENT ACTIVITY */}
                <section className="profile-section" aria-label="Recent activity">
                  <div className="profile-section__head">
                    <h3 className="profile-section__label">· Recent activity</h3>
                  </div>
                  {profile.recent_activity.length > 0 ? (
                    <ul className="list">
                      {profile.recent_activity.slice(0, 5).map((item) => {
                        const href =
                          item.kind === "feed"
                            ? `/app/community?tab=feed&post=${item.id}`
                            : `/app/community?tab=ideas&idea=${item.id}`;
                        return (
                          <li key={`${item.kind}-${item.id}`}>
                            <span className="grow">
                              <span className="label" style={{ fontSize: 11, marginRight: 8 }}>
                                {item.kind === "feed" ? "Feed" : "Idea"}
                              </span>
                              {item.title}
                            </span>
                            <Link href={href} className="profile-modal__link">
                              Open ↗
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="profile-empty-dash">—</p>
                  )}
                </section>
              </div>
            </>
          )}
        </div>

        {/* Sticky action bar: Share is the last focusable button in view mode */}
        {profile && (
          <footer className="profile-modal__actionbar">
            {editing && isOwner ? (
              <div className="row" style={{ "--g": "8px", marginLeft: "auto" } as React.CSSProperties}>
                <button
                  type="button"
                  className="btn sm line"
                  disabled={editBusy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="profile-edit-form"
                  className="btn sm"
                  disabled={editBusy}
                >
                  {editBusy ? "Saving…" : "Save"}
                </button>
              </div>
            ) : (
              <>
                <div className="row" style={{ "--g": "8px" } as React.CSSProperties}>
                  {isOwner ? (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setEditing(true)}
                    >
                      Edit profile
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`btn sm ${hasKudos ? "" : "line"}`}
                        aria-pressed={hasKudos}
                        onClick={() => void act("toggle", { list: "kudos", id: kudosId })}
                      >
                        {hasKudos ? "Kudos ✓" : "Kudos"}
                      </button>
                      <button
                        type="button"
                        className="btn sm line"
                        disabled={alreadyPinged}
                        onClick={() => setPingOpen((v) => !v)}
                      >
                        {alreadyPinged ? "Pinged ✓" : "Ping"}
                      </button>
                    </>
                  )}
                  <AdminMenu
                    userId={profile.id}
                    memberName={profile.name}
                    isAlumni={profile.is_alumni}
                    currentRoleLabel={profile.role}
                    onDone={async () => {
                      await onMutated();
                      await loadProfile();
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn sm line"
                  onClick={handleShare}
                >
                  {copied ? "Copied ✓" : "Share"}
                </button>
              </>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

export default ProfileModal;
