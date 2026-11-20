'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { canFully, rankFor, isAdmin } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import type { MemberProfile, BlogPost, AlumniJob } from '@fecpc/contracts';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AlumniProfileModal({
  userId,
  onClose,
  onMutated,
}: {
  userId: string;
  onClose: () => void;
  onMutated?: () => void;
}) {
  const { me, s, act } = useStore();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [available, setAvailable] = useState(false);
  const [togglingAvailable, setTogglingAvailable] = useState(false);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [jobsPosted, setJobsPosted] = useState<AlumniJob[]>([]);
  const [kudosCount, setKudosCount] = useState(0);
  const [pinged, setPinged] = useState(false);
  const [pingNote, setPingNote] = useState('');
  const [pingOpen, setPingOpen] = useState(false);
  const [pingBusy, setPingBusy] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profRes, blogsRes, jobsRes] = await Promise.all([
        fetch('/api/members', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'getMemberProfile', userId }),
        }),
        fetch('/api/alumni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'listBlogPosts' }),
        }).catch(() => null),
        fetch('/api/alumni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'listAlumniJobs' }),
        }).catch(() => null),
      ]);

      if (!profRes.ok) {
        const j = await profRes.json().catch(() => ({}));
        setError(j.error ?? 'Could not load alumni profile.');
        return;
      }

      const prof = (await profRes.json()) as MemberProfile;
      setProfile(prof);
      setAvailable(Boolean(prof.available_for_questions));

      if (blogsRes && blogsRes.ok) {
        const bData = await blogsRes.json();
        const pList = (bData.posts || []) as BlogPost[];
        setBlogPosts(pList.filter((p) => p.author_id === userId || p.author_name === prof.name));
      }

      if (jobsRes && jobsRes.ok) {
        const jData = await jobsRes.json();
        const jList = (jData.jobs || []) as AlumniJob[];
        setJobsPosted(jList.filter((j) => j.alumni_id === userId));
      }
    } catch {
      setError('Network error while loading alumni profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Trap focus + Escape key
  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

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

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isOwner = me.id === userId;
  const canAdmin = isAdmin(s.roles),
    canToggle = isOwner || canFully(s.roles, 'alumni.toggleMentoring');

  const handleToggleAvailable = async () => {
    if (!canToggle || togglingAvailable) return;

    const next = !available;
    setAvailable(next);
    setTogglingAvailable(true);

    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'setAvailableForQuestions',
          available: next,
          alumniId: userId,
        }),
      });
      if (!res.ok) {
        setAvailable(!next); // revert
      } else {
        onMutated?.();
      }
    } catch {
      setAvailable(!next);
    } finally {
      setTogglingAvailable(false);
    }
  };

  const handlePingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pingBusy) return;
    setPingBusy(true);
    try {
      await act('ping', { to: userId, kind: 'invite', ref: pingNote.trim() || undefined });
      setPinged(true);
      setPingOpen(false);
      setPingNote('');
    } catch (err: any) {
      alert(err?.message || 'Could not ping member.');
    } finally {
      setPingBusy(false);
    }
  };

  const handleKudos = () => {
    setKudosCount((c) => c + 1);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile?.name || 'Alumni Profile', url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Profile link copied to clipboard!');
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!window.confirm('Are you sure you want to delete this job posting?')) return;
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'deleteAlumniJob', jobId }),
      });
      if (res.ok) {
        setJobsPosted((prev) => prev.filter((j) => j.id !== jobId));
      }
    } catch {
      alert('Failed to delete job.');
    }
  };

  if (loading) {
    return (
      <div
        className="ov open"
        role="presentation"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11, 11, 11, 0.62)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(2px)',
        }}
      >
        <div
          className="panel"
          style={{
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
            color: 'var(--ink, #0B0B0B)',
            padding: '32px 48px',
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: 13,
          }}
        >
          Loading alumni profile…
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        className="ov open"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11, 11, 11, 0.62)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(2px)',
        }}
      >
        <div
          className="panel"
          style={{
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
            color: 'var(--ink, #0B0B0B)',
            padding: 32,
            maxWidth: 440,
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--acc, #c4321c)', marginBottom: 16 }}>
            {error || 'Alumni profile not found.'}
          </p>
          <button type="button" className="btn line" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const rank = rankFor(profile.problems_solved, profile.cf_handle);
  const batchNumber = profile.batch ?? 16;
  const batchStr = String(batchNumber).slice(-2);
  const batchYear = profile.batch ? 2000 + Number(String(profile.batch).slice(-2)) : 2016;
  const joinedYear = batchYear - 4;
  const gradYear = batchYear;
  const firstName = profile.name.split(' ')[0] || profile.name;

  const skills =
    profile.skills && profile.skills.length > 0
      ? profile.skills
      : ['Interview prep', 'System design', 'Fintech'];
  const company =
    (profile as any).company || (profile as any).experience?.[0]?.company || 'Tech Company';
  const roleTitle = profile.role || 'Software Engineer';

  return (
    <div
      className="ov open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 11, 11, 0.62)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 24px',
        overflowY: 'auto',
        zIndex: 9999,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        ref={modalRef}
        className="md"
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name} alumni profile`}
        style={{
          position: 'relative',
          display: 'block',
          maxWidth: 1080,
          width: '100%',
          padding: 0,
          background: 'var(--panel, #F6F4EE)',
          border: '2px solid var(--line2, #0B0B0B)',
          boxShadow: '10px 10px 0 var(--line2, #0B0B0B)',
          animation: 'rise 0.2s ease-out',
        }}
      >
        {/* Close button in top-right */}
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            minWidth: 44,
            height: 44,
            position: 'absolute',
            right: 16,
            top: 16,
            zIndex: 10,
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
            color: 'var(--ink, #0B0B0B)',
            cursor: 'pointer',
            fontSize: 24,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* 440px Hero Banner (matches mockup ee3a8fc9) */}
        <div
          style={{
            position: 'relative',
            background: 'var(--acc, #1F3BFF)',
            color: 'var(--on, #FFFFFF)',
            padding: 40,
            overflow: 'hidden',
            minHeight: 440,
          }}
        >
          {/* Giant 380px ghost batch number */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: -10,
              top: -40,
              font: '700 380px/1 Inter, Arial, sans-serif',
              letterSpacing: '-14px',
              color: 'transparent',
              WebkitTextStroke: '2px rgba(255,255,255,.3)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {batchStr}
          </span>

          <div style={{ position: 'relative' }}>
            {/* Batch Pill */}
            <span
              className="m"
              style={{
                color: 'var(--on, #FFFFFF)',
                border: '1px solid var(--on, #FFFFFF)',
                padding: '4px 10px',
                display: 'inline-block',
                marginBottom: 24,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                fontFamily: 'var(--mono)',
                fontSize: 11,
              }}
            >
              Alumni · Class of {batchYear}
            </span>

            {/* Avatar + Name Details */}
            <div
              style={{
                display: 'flex',
                gap: 28,
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                maxWidth: 700,
              }}
            >
              {/* 128px Avatar Container with crisp borders */}
              <div
                style={{
                  background: 'var(--panel, #F6F4EE)',
                  border: '3px solid var(--line2, #0B0B0B)',
                  padding: 6,
                  lineHeight: 0,
                  flex: 'none',
                }}
              >
                <AvatarRing
                  name={profile.name}
                  solved={profile.problems_solved}
                  cfHandle={profile.cf_handle}
                  avatarUrl={profile.avatar_url}
                  size={128}
                  ringWidth={3}
                  ringOffset={4}
                  notched
                  rank={rank}
                />
              </div>

              <div>
                <h2
                  style={{
                    fontSize: 'clamp(36px, 5vw, 60px)',
                    lineHeight: 1,
                    color: 'var(--on, #FFFFFF)',
                    margin: '0 0 12px',
                    letterSpacing: '-2px',
                    fontWeight: 700,
                  }}
                >
                  {profile.name}
                </h2>
                <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--on, #FFFFFF)' }}>
                  {roleTitle}
                </div>
                <div
                  className="m"
                  style={{
                    color: 'var(--on, #DCE1FF)',
                    opacity: 0.9,
                    marginTop: 8,
                    fontSize: 12,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {company} · {profile.location || 'Dhaka'} · {profile.dept || 'CSE'}
                </div>
              </div>
            </div>

            {/* Horizontal Timeline */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                gap: 16,
                maxWidth: 640,
                marginTop: 48,
              }}
            >
              {/* Connecting line across timeline */}
              <i
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 7,
                  height: 2,
                  background: 'rgba(255,255,255,.5)',
                  display: 'block',
                }}
              />

              {/* Step 1: Joined */}
              <div style={{ flex: 1, position: 'relative' }}>
                <i
                  style={{
                    display: 'block',
                    width: 16,
                    height: 16,
                    border: '2px solid var(--on, #FFFFFF)',
                    background: 'var(--acc, #1F3BFF)',
                  }}
                />
                <div
                  className="m"
                  style={{ color: 'var(--on, #DCE1FF)', opacity: 0.9, marginTop: 12 }}
                >
                  [{joinedYear}]
                </div>
                <div style={{ fontWeight: 600, color: 'var(--on, #FFFFFF)', marginTop: 2 }}>
                  Joined the club
                </div>
              </div>

              {/* Step 2: Graduated */}
              <div style={{ flex: 1, position: 'relative' }}>
                <i
                  style={{
                    display: 'block',
                    width: 16,
                    height: 16,
                    border: '2px solid var(--on, #FFFFFF)',
                    background: 'var(--acc, #1F3BFF)',
                  }}
                />
                <div
                  className="m"
                  style={{ color: 'var(--on, #DCE1FF)', opacity: 0.9, marginTop: 12 }}
                >
                  [{gradYear}]
                </div>
                <div style={{ fontWeight: 600, color: 'var(--on, #FFFFFF)', marginTop: 2 }}>
                  Graduated
                </div>
              </div>

              {/* Step 3: Now */}
              <div style={{ flex: 1, position: 'relative' }}>
                <i
                  style={{
                    display: 'block',
                    width: 16,
                    height: 16,
                    border: '2px solid var(--on, #FFFFFF)',
                    background: 'var(--on, #FFFFFF)',
                  }}
                />
                <div
                  className="m"
                  style={{ color: 'var(--on, #DCE1FF)', opacity: 0.9, marginTop: 12 }}
                >
                  Now
                </div>
                <div style={{ fontWeight: 600, color: 'var(--on, #FFFFFF)', marginTop: 2 }}>
                  {roleTitle} · {company}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Body Content & Sticky Alumni Pass Sidebar */}
        <div
          style={{
            display: 'flex',
            gap: 40,
            flexWrap: 'wrap',
            padding: '0 40px 40px',
            alignItems: 'flex-start',
          }}
        >
          {/* Left Column (flex: 2 1 460px) */}
          <div style={{ flex: '2 1 460px', minWidth: 0, paddingTop: 32 }}>
            {/* Scoreboard .sb (Rating, Solved, Streak, Contests) */}
            <div
              className="sb"
              style={{
                display: 'flex',
                border: '2px solid var(--line2, #0B0B0B)',
                marginBottom: 32,
                background: 'var(--bg, #FFFFFF)',
              }}
            >
              <div style={{ flex: 1, padding: 16, borderLeft: 0 }}>
                <b style={{ display: 'block', fontSize: 32, color: rank.color || '#0000FF' }}>
                  {profile.cf_rating || profile.rating || '—'}
                </b>
                <span className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                  Rating
                </span>
              </div>
              <div style={{ flex: 1, padding: 16, borderLeft: '1px solid var(--line, #cfcbbf)' }}>
                <b style={{ display: 'block', fontSize: 32, color: rank.color || '#0000FF' }}>
                  {profile.problems_solved || 0}
                </b>
                <span className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                  Solved
                </span>
              </div>
              <div style={{ flex: 1, padding: 16, borderLeft: '1px solid var(--line, #cfcbbf)' }}>
                <b style={{ display: 'block', fontSize: 32, color: rank.color || '#0000FF' }}>
                  {profile.current_streak ? `${profile.current_streak}d` : '0d'}
                </b>
                <span className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                  Streak
                </span>
              </div>
              <div style={{ flex: 1, padding: 16, borderLeft: '1px solid var(--line, #cfcbbf)' }}>
                <b style={{ display: 'block', fontSize: 32, color: rank.color || '#0000FF' }}>
                  {String(profile.contests_participated || 0).padStart(2, '0')}
                </b>
                <span className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                  Contests
                </span>
              </div>
            </div>

            {/* About Section */}
            <section className="sc" style={{ marginBottom: 32 }}>
              <div
                className="m"
                style={{
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--line, #cfcbbf)',
                  marginBottom: 16,
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
                · About
              </div>
              <p
                style={{ fontSize: 20, lineHeight: 1.45, margin: 0, color: 'var(--ink, #0B0B0B)' }}
              >
                {profile.bio ||
                  'Competitive programmer and software engineer passionate about scalable systems.'}
              </p>
            </section>

            {/* Career Path Section */}
            <section className="sc" style={{ marginBottom: 32 }}>
              <div
                className="m"
                style={{
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--line, #cfcbbf)',
                  marginBottom: 16,
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
                · Career path
              </div>

              {/* Step 1: Now */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <i
                    style={{
                      width: 10,
                      height: 10,
                      background: 'var(--acc, #1F3BFF)',
                      display: 'block',
                    }}
                  />
                  <i
                    style={{
                      width: 2,
                      flex: 1,
                      background: 'var(--acc, #1F3BFF)',
                      display: 'block',
                      minHeight: 36,
                    }}
                  />
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                    Now
                  </div>
                  <b style={{ fontSize: 16, color: 'var(--ink, #0B0B0B)' }}>
                    {roleTitle} · {company}
                  </b>
                  <p
                    className="t"
                    style={{ fontSize: 14, color: 'var(--mut, #3B3A35)', marginTop: 4 }}
                  >
                    Working on distributed backend services and infrastructure.
                  </p>
                </div>
              </div>

              {/* Step 2: Graduated */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <i
                    style={{
                      width: 10,
                      height: 10,
                      background: 'var(--acc, #1F3BFF)',
                      display: 'block',
                    }}
                  />
                  <i
                    style={{
                      width: 2,
                      flex: 1,
                      background: 'var(--acc, #1F3BFF)',
                      display: 'block',
                      minHeight: 36,
                    }}
                  />
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                    [{gradYear}]
                  </div>
                  <b style={{ fontSize: 16, color: 'var(--ink, #0B0B0B)' }}>
                    Graduated · Batch {batchNumber}
                  </b>
                  <p
                    className="t"
                    style={{ fontSize: 14, color: 'var(--mut, #3B3A35)', marginTop: 4 }}
                  >
                    Department of {profile.dept || 'Computer Science and Engineering'}.
                  </p>
                </div>
              </div>

              {/* Step 3: Club */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <i
                    style={{
                      width: 10,
                      height: 10,
                      background: 'var(--acc, #1F3BFF)',
                      display: 'block',
                    }}
                  />
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                    [{joinedYear}–{gradYear}]
                  </div>
                  <b style={{ fontSize: 16, color: 'var(--ink, #0B0B0B)' }}>FECPC Member</b>
                  <p
                    className="t"
                    style={{ fontSize: 14, color: 'var(--mut, #3B3A35)', marginTop: 4 }}
                  >
                    Active contest competitor and mentor in competitive programming.
                  </p>
                </div>
              </div>
            </section>

            {/* Blog Posts Section */}
            {blogPosts.length > 0 && (
              <section className="sc" style={{ marginBottom: 32 }}>
                <div
                  className="m"
                  style={{
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--line, #cfcbbf)',
                    marginBottom: 16,
                    color: 'var(--dim, #5F5F5F)',
                  }}
                >
                  · Blog posts
                </div>
                {blogPosts.map((post) => (
                  <div
                    key={post.id}
                    className="r"
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'center',
                      padding: '12px 0',
                      borderTop: '1px solid var(--line, #cfcbbf)',
                    }}
                  >
                    <span
                      className="g"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 600,
                        color: 'var(--ink, #0B0B0B)',
                      }}
                    >
                      {post.title}
                    </span>
                    <span className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                      {post.created_at
                        ? new Date(post.created_at).toLocaleDateString('en-GB', {
                            month: 'short',
                            year: 'numeric',
                          })
                        : ''}
                    </span>
                    <a
                      href={`/app/community?tab=blogs&read=${post.slug}`}
                      className="m"
                      style={{
                        color: 'var(--acc, #1F3BFF)',
                        textDecoration: 'none',
                        fontWeight: 700,
                      }}
                    >
                      Open ↗
                    </a>
                  </div>
                ))}
              </section>
            )}

            {/* Jobs Posted Section */}
            {jobsPosted.length > 0 && (
              <section className="sc" style={{ marginBottom: 32 }}>
                <div
                  className="m"
                  style={{
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--line, #cfcbbf)',
                    marginBottom: 16,
                    color: 'var(--dim, #5F5F5F)',
                  }}
                >
                  · Jobs posted
                </div>
                {jobsPosted.map((job) => (
                  <div
                    key={job.id}
                    className="r"
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'center',
                      padding: '12px 0',
                      borderTop: '1px solid var(--line, #cfcbbf)',
                    }}
                  >
                    <span
                      className="g"
                      style={{ flex: 1, minWidth: 0, color: 'var(--ink, #0B0B0B)' }}
                    >
                      <b>{job.company}</b> · {job.title || job.role}
                    </span>
                    <span className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                      {job.location || 'Remote'}
                    </span>
                    <span className="tg" style={{ margin: 0, padding: '2px 6px', fontSize: 10 }}>
                      {job.source || 'manual'}
                    </span>
                    {(isOwner || canAdmin) && (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => handleDeleteJob(job.id)}
                        style={{ minHeight: 32, padding: '0 8px', fontSize: 11 }}
                      >
                        Delete
                      </button>
                    )}
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn sm"
                        style={{
                          minHeight: 32,
                          padding: '0 10px',
                          fontSize: 11,
                          textDecoration: 'none',
                        }}
                      >
                        Apply ↗
                      </a>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* Right Column: Alumni Pass (Sticky, floating up -100px) */}
          <aside
            style={{
              flex: '1 1 300px',
              maxWidth: 340,
              marginTop: -100,
              position: 'relative',
              zIndex: 3,
              background: 'var(--panel, #F6F4EE)',
              border: '2px solid var(--line2, #0B0B0B)',
              boxShadow: '6px 6px 0 var(--line2, #0B0B0B)',
            }}
          >
            {/* Dark Top Ribbon */}
            <div style={{ background: 'var(--ink, #0B0B0B)', padding: '12px 20px' }}>
              <span
                className="m"
                style={{ color: 'var(--on, #FFFFFF)', fontSize: 11, fontWeight: 700 }}
              >
                Alumni pass
              </span>
            </div>

            <div style={{ padding: 20 }}>
              {/* Mentoring Status */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
                <i
                  style={{
                    width: 14,
                    height: 14,
                    background: available ? 'var(--acc, #1F3BFF)' : 'var(--dim, #6B6B6B)',
                    display: 'inline-block',
                  }}
                />
                <b className="m" style={{ color: 'var(--ink, #0B0B0B)', fontSize: 13 }}>
                  {available ? 'Open to questions' : 'Not mentoring'}
                </b>
              </div>

              {/* Ask Me About Tags */}
              <div className="m" style={{ marginBottom: 8, color: 'var(--dim, #5F5F5F)' }}>
                Ask me about
              </div>
              <div style={{ marginBottom: 16 }}>
                {skills.map((sk) => (
                  <span
                    key={sk}
                    className="tg"
                    style={{
                      display: 'inline-block',
                      font: '11px ui-monospace,Menlo,monospace',
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      border: '1px solid var(--line2, #0B0B0B)',
                      padding: '4px 8px',
                      margin: '0 6px 6px 0',
                      background: 'var(--bg, #FFFFFF)',
                      color: 'var(--ink, #0B0B0B)',
                    }}
                  >
                    {sk}
                  </span>
                ))}
              </div>

              {/* Response Expectations */}
              <p
                className="t"
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--dim, #5F5F5F)',
                  marginBottom: 20,
                }}
              >
                {available
                  ? 'Usually replies within a few days.'
                  : 'Currently not taking new mentorship inquiries.'}
              </p>

              {/* Ping Button / Form */}
              {pingOpen ? (
                <form onSubmit={handlePingSubmit} style={{ marginBottom: 16 }}>
                  <textarea
                    rows={3}
                    placeholder={`Write a quick message to ${firstName}…`}
                    value={pingNote}
                    onChange={(e) => setPingNote(e.target.value)}
                    style={{
                      width: '100%',
                      fontSize: 13,
                      padding: '8px 10px',
                      border: '2px solid var(--line2, #0B0B0B)',
                      background: 'var(--bg, #FFFFFF)',
                      color: 'var(--ink, #0B0B0B)',
                      marginBottom: 8,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setPingOpen(false)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={pingBusy}
                      className="btn k sm"
                      style={{ flex: 1 }}
                    >
                      {pingBusy ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </form>
              ) : pinged ? (
                <div
                  style={{
                    background: 'var(--ink, #0B0B0B)',
                    color: 'var(--on, #FFFFFF)',
                    padding: '10px 14px',
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  Ping sent ✓
                </div>
              ) : (
                <button
                  type="button"
                  className="btn k"
                  onClick={() => {
                    if (isOwner) {
                      alert('You cannot ping yourself.');
                    } else {
                      setPingOpen(true);
                    }
                  }}
                  style={{
                    width: '100%',
                    marginBottom: 8,
                    background: 'var(--ink, #0B0B0B)',
                    color: 'var(--on, #FFFFFF)',
                    minHeight: 44,
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Ping {firstName}
                </button>
              )}

              {/* Kudos & Share Buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleKudos}
                  style={{ flex: 1, minHeight: 40, fontSize: 13, fontWeight: 600 }}
                >
                  {kudosCount > 0 ? `Kudos (${kudosCount})` : 'Kudos'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleShare}
                  style={{ flex: 1, minHeight: 40, fontSize: 13, fontWeight: 600 }}
                >
                  Share
                </button>
              </div>

              {/* External Links */}
              <div
                style={{
                  borderTop: '1px solid var(--line, #cfcbbf)',
                  paddingTop: 16,
                  marginBottom: 16,
                }}
              >
                {profile.cf_handle && (
                  <a
                    href={`https://codeforces.com/profile/${profile.cf_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lk"
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      font: '13px ui-monospace,Menlo,monospace',
                      color: 'var(--ink, #0B0B0B)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    CF handle ↗
                  </a>
                )}
                {profile.github_url && (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lk"
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      font: '13px ui-monospace,Menlo,monospace',
                      color: 'var(--ink, #0B0B0B)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    GitHub ↗
                  </a>
                )}
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lk"
                    style={{
                      display: 'block',
                      margin: 0,
                      font: '13px ui-monospace,Menlo,monospace',
                      color: 'var(--ink, #0B0B0B)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    LinkedIn ↗
                  </a>
                )}
              </div>

              {canToggle && (
                <label
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    borderTop: '1px solid var(--line, #cfcbbf)',
                    paddingTop: 16,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={handleToggleAvailable}
                    disabled={togglingAvailable}
                    style={{ width: 20, minHeight: 20, cursor: 'pointer' }}
                  />
                  <span
                    className="m"
                    style={{ color: 'var(--ink, #0B0B0B)', fontSize: 11, fontWeight: 600 }}
                  >
                    Available · owner and admin only
                  </span>
                </label>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default AlumniProfileModal;
