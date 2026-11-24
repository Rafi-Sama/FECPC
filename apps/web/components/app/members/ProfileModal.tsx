'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { useStore } from '@/components/app/Store';
import { RANKS, rankFor, canFully } from '@fecpc/contracts';
import type { MemberContestRow, MemberProfile, Rank } from '@fecpc/contracts';
import { AdminMenu } from './AdminMenu';
import { AlumniSection } from './AlumniSection';
import { ProfileForm } from './ProfileForm';

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
  const { s, me, act, counts, members } = useStore();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'getMemberProfile', userId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Could not load member profile.');
        setProfile(null);
        return;
      }
      const data = (await res.json()) as MemberProfile;
      setProfile(data);
    } catch {
      setError('Network error while loading profile.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setEditing(false);
    setCopied(false);
    void loadProfile();
  }, [loadProfile]);

  // Body scroll lock while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Initial focus to close button (×) and focus trap + Esc close
  useEffect(() => {
    if (editing) return; // the form on top handles its own keys
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null && !el.classList.contains('sr'),
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

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, editing]);

  const isOwner = me.id === userId;
  // Officers edit others; the President's and Super Admin's accounts are the Super Admin's (the API checks).
  const targetRole = members.find((m) => m.id === userId)?.roleKey;
  const canEdit =
    !isOwner &&
    !!canFully(s.roles, 'member.editDetails') &&
    (!['president', 'super_admin'].includes(targetRole ?? '') || s.role === 'super_admin');
  const kudosId = `member:${userId}`;
  const hasKudos = s.kudos.includes(kudosId);
  const kudosTotal = counts.kudos?.[kudosId] ?? 0;

  const rank = rankFor(profile && (profile.cf_rating || profile.rating));
  const roleLabel = profile ? profile.role || (profile.is_alumni ? 'Alumni' : 'Member') : '';

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  };

  const contests = profile ? [...profile.contest_history].slice(0, 24).reverse() : [];
  const toContests =
    contests.length > 0
      ? () =>
          document
            .getElementById('dossier-contests')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      : undefined;

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
        className="profile-modal dossier"
        role="dialog"
        aria-modal="true"
        aria-label={profile ? `${profile.name} profile` : 'Member profile'}
        style={
          {
            '--rank-color': rank.unrated ? 'var(--dim)' : rank.color,
            '--rank-text': rank.textColor,
          } as CSSProperties
        }
      >
        <header className="profile-modal__topbar">
          <span className="dossier__no">
            {editing
              ? 'Edit profile'
              : profile
                ? `FEC-${String(profile.no).padStart(4, '0')}`
                : 'Member profile'}
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="profile-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </header>

        <div className="dossier__scroll">
          {loading && !profile ? (
            <div className="dossier__state">
              <span className="dossier__skel" />
              <span className="dossier__skel dossier__skel--short" />
            </div>
          ) : error || !profile ? (
            <div className="dossier__state">
              <p className="body bad">{error || 'Member not found.'}</p>
            </div>
          ) : (
            <>
              <section className="dossier__hero">
                <div className="dossier__id">
                  <AvatarRing
                    name={profile.name}
                    avatarUrl={profile.avatar_url}
                    size={84}
                    ringWidth={3}
                    ringOffset={4}
                    notched
                    rank={rank}
                  />
                  <div className="dossier__who">
                    <h2 className="dossier__name">{profile.name}</h2>
                    <p className="dossier__line">
                      {roleLabel} · {profile.dept} · Batch {profile.batch}
                      {profile.is_alumni && <span className="alumni-tag">Alumni</span>}
                    </p>
                    <div className="dossier__links">
                      {profile.cf_handle && (
                        <ExtLink
                          href={`https://codeforces.com/profile/${encodeURIComponent(profile.cf_handle)}`}
                        >
                          {profile.cf_handle}
                        </ExtLink>
                      )}
                      {profile.github_url && <ExtLink href={profile.github_url}>GitHub</ExtLink>}
                      {profile.linkedin_url && (
                        <ExtLink href={profile.linkedin_url}>LinkedIn</ExtLink>
                      )}
                    </div>
                  </div>
                </div>
                <RankLadder solved={profile.problems_solved} rank={rank} />
              </section>

              <div className="dossier__stats" aria-label="Member statistics">
                <StatTile
                  label="Rating"
                  value={profile.cf_rating && profile.cf_rating > 0 ? profile.cf_rating : null}
                  onClick={toContests}
                />
                <StatTile
                  label="Streak"
                  value={profile.current_streak > 0 ? profile.current_streak : null}
                  suffix="d"
                />
                <StatTile
                  label="Contests"
                  value={profile.contests_participated > 0 ? profile.contests_participated : null}
                  onClick={toContests}
                />
                <StatTile label="Kudos" value={kudosTotal > 0 ? kudosTotal : null} />
              </div>

              <div
                className={`dossier__body${contests.length || profile.recent_activity.length ? '' : ' is-single'}`}
              >
                <div className="dossier__main">
                  <section className="dossier__sec" aria-label="About">
                    <h3 className="dossier__h">About</h3>
                    {profile.bio ? (
                      <p className="dossier__bio">{profile.bio}</p>
                    ) : (
                      <p className="dossier__empty">
                        {isOwner ? 'Add a bio from Edit profile.' : 'No bio yet.'}
                      </p>
                    )}
                    {profile.skills.length > 0 && (
                      <div className="dossier__skills">
                        {profile.skills.map((sk) => (
                          <Link
                            key={sk}
                            href={`/app/directory?skill=${encodeURIComponent(sk)}`}
                            className="dossier__skill"
                            title={`Members with ${sk}`}
                          >
                            {sk}
                          </Link>
                        ))}
                      </div>
                    )}
                    {profile.is_alumni && (
                      <div className="dossier__availability">
                        <span className="dossier__tag">
                          {profile.available_for_questions
                            ? 'Available for questions'
                            : 'Not taking questions'}
                        </span>
                        {(isOwner || canFully(s.roles, 'alumni.toggleQuestions')) && (
                          <button
                            type="button"
                            className="btn xs line"
                            onClick={async () => {
                              const next = !profile.available_for_questions;
                              const res = await fetch('/api/alumni', {
                                method: 'POST',
                                headers: { 'content-type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'setAvailableForQuestions',
                                  userId: profile.id,
                                  value: next,
                                }),
                              });
                              if (res.ok) {
                                setProfile((p) =>
                                  p ? { ...p, available_for_questions: next } : p,
                                );
                                await onMutated();
                              }
                            }}
                          >
                            {profile.available_for_questions
                              ? 'Stop taking questions'
                              : 'Make available'}
                          </button>
                        )}
                      </div>
                    )}
                  </section>

                  {profile.experience.length > 0 && (
                    <section className="dossier__sec" aria-label="Experience">
                      <h3 className="dossier__h">Experience</h3>
                      <ol className="dossier__journey">
                        {profile.experience.map((exp, idx) => (
                          <li
                            key={`${exp.period}-${exp.role}-${idx}`}
                            style={{ '--i': idx } as CSSProperties}
                          >
                            <span className="dossier__period">{exp.period}</span>
                            <strong className="dossier__role">{exp.role}</strong>
                            {exp.summary && <p className="dossier__summary">{exp.summary}</p>}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {profile.is_alumni && <AlumniSection profile={profile} onReload={loadProfile} />}
                </div>

                {(contests.length > 0 || profile.recent_activity.length > 0) && (
                  <aside className="dossier__side">
                    {contests.length > 0 && (
                      <section className="dossier__sec" id="dossier-contests" aria-label="Contests">
                        <h3 className="dossier__h">Rating changes</h3>
                        <ContestChart rows={contests} />
                      </section>
                    )}
                    {profile.recent_activity.length > 0 && (
                      <section className="dossier__sec" aria-label="Recent activity">
                        <h3 className="dossier__h">Recent activity</h3>
                        <ul className="dossier__activity">
                          {profile.recent_activity.slice(0, 5).map((item) => (
                            <li key={`${item.kind}-${item.id}`}>
                              <Link
                                href={
                                  item.kind === 'feed'
                                    ? `/app/community?tab=feed&post=${item.id}`
                                    : `/app/community?tab=ideas&idea=${item.id}`
                                }
                              >
                                <span className="dossier__kind">
                                  {item.kind === 'feed' ? 'Post' : 'Idea'}
                                </span>
                                <span className="dossier__act-title">{item.title}</span>
                                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                                  <path
                                    d="M5 11l6-6M6 5h5v5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                  />
                                </svg>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </aside>
                )}
              </div>
            </>
          )}
        </div>

        {profile && (
          <footer className="profile-modal__actionbar">
            {
              <>
                <div className="row" style={{ '--g': '8px' } as CSSProperties}>
                  {isOwner ? (
                    <button type="button" className="btn sm" onClick={() => setEditing(true)}>
                      Request a change
                    </button>
                  ) : (
                    <KudosButton
                      on={hasKudos}
                      total={kudosTotal}
                      onToggle={() => void act('toggle', { list: 'kudos', id: kudosId, on: true })}
                    />
                  )}
                  {canEdit && (
                    <button type="button" className="btn sm line" onClick={() => setEditing(true)}>
                      Edit profile
                    </button>
                  )}
                  <AdminMenu
                    userId={profile.id}
                    memberName={profile.name}
                    isAlumni={profile.is_alumni}
                    onDone={async () => {
                      await onMutated();
                      await loadProfile();
                    }}
                  />
                </div>
                <button type="button" className="btn sm line" onClick={handleShare}>
                  {copied ? 'Link copied' : 'Share'}
                </button>
              </>
            }
          </footer>
        )}
      </div>
      {editing && profile && (
        <ProfileForm
          profile={profile}
          mode={isOwner ? 'request' : 'edit'}
          onClose={async (saved) => {
            setEditing(false);
            if (!saved) return;
            await loadProfile();
            await onMutated();
          }}
        />
      )}
    </div>
  );
}

const EASE = (t: number) => 1 - Math.pow(2, -10 * t);

/** Counts from 0 to `to` once on mount; jumps straight there under reduced motion. */
function useCountUp(to: number, ms = 900) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(to);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * EASE(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

function StatTile({
  label,
  value,
  suffix = '',
  onClick,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  onClick?: () => void;
}) {
  const n = useCountUp(value ?? 0);
  const body = (
    <>
      <span className={`dossier__stat-v${value === null ? ' is-empty' : ''}`}>
        {value === null ? '—' : `${n}${suffix}`}
      </span>
      <span className="dossier__stat-l">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="dossier__stat is-link" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="dossier__stat">{body}</div>
  );
}

/** Every tier as one rung; the current rung fills by progress through its range. */
function RankLadder({ solved, rank }: { solved: number; rank: Rank }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = useCountUp(rank.unrated ? 0 : solved);
  const idx = RANKS.findIndex((r) => r.title === rank.title);
  const next = idx >= 0 ? RANKS[idx + 1] : RANKS[0];
  const fill = (i: number) => {
    if (rank.unrated || i > idx) return 0;
    if (i < idx) return 1;
    const r = RANKS[i]!;
    return Number.isFinite(r.max) ? Math.min(1, (solved - r.min + 1) / (r.max - r.min + 1)) : 1;
  };
  const focus = hover !== null ? RANKS[hover]! : null;
  return (
    <div className="ladder">
      <div className="ladder__top">
        <span className="ladder__n">{rank.unrated ? '—' : shown}</span>
        <span className="ladder__cap">
          {focus
            ? `${focus.title} · ${focus.min}${Number.isFinite(focus.max) ? `–${focus.max}` : '+'} solved`
            : rank.unrated
              ? 'Link a Codeforces handle to get ranked'
              : next
                ? `solved · ${rank.title} · ${next.min - solved} to ${next.title}`
                : `solved · ${rank.title}`}
        </span>
      </div>
      <div className="ladder__rungs" onPointerLeave={() => setHover(null)}>
        {RANKS.map((r, i) => (
          <button
            key={r.title}
            type="button"
            className={`ladder__rung${i === idx ? ' is-here' : ''}`}
            style={{ '--c': r.color, '--f': fill(i), '--i': i } as CSSProperties}
            aria-label={`${r.title}: ${r.min}${Number.isFinite(r.max) ? ` to ${r.max}` : ' or more'} solved`}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <i />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Rating change per contest, oldest to newest; hover or arrow keys to read one. */
function ContestChart({ rows }: { rows: MemberContestRow[] }) {
  const [sel, setSel] = useState(rows.length - 1);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.delta)));
  const cur = rows[sel];
  const net = rows.reduce((a, r) => a + r.delta, 0);
  const fmt = (d: number) => (d >= 0 ? `+${d}` : `−${Math.abs(d)}`);
  return (
    <div className="chart">
      <div className="chart__read" aria-live="polite">
        {cur && (
          <>
            <strong className="chart__name">{cur.name}</strong>
            <span className="chart__facts">
              Rank #{cur.rank}
              {cur.date ? ` · ${cur.date}` : ''}
            </span>
            <span className={`chart__delta ${cur.delta >= 0 ? 'up' : 'down'}`}>
              {fmt(cur.delta)}
            </span>
          </>
        )}
      </div>
      <div
        className="chart__bars"
        role="listbox"
        aria-label={`Rating changes, net ${fmt(net)}`}
        tabIndex={0}
        aria-activedescendant={`chart-bar-${sel}`}
        onKeyDown={(e) => {
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          setSel((v) => Math.max(0, Math.min(rows.length - 1, v + d)));
        }}
      >
        {rows.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            id={`chart-bar-${i}`}
            role="option"
            aria-selected={i === sel}
            aria-label={`${r.name}: rank ${r.rank}, ${fmt(r.delta)}`}
            className={`chart__col${i === sel ? ' is-sel' : ''}`}
            onPointerEnter={() => setSel(i)}
            onClick={() => setSel(i)}
            style={{ '--h': Math.abs(r.delta) / max, '--i': i } as CSSProperties}
          >
            <i className={r.delta >= 0 ? 'up' : 'down'} />
          </div>
        ))}
      </div>
      <p className="chart__net">
        Net over {rows.length} contest{rows.length === 1 ? '' : 's'}:{' '}
        <b className={net >= 0 ? 'up' : 'down'}>{fmt(net)}</b>
      </p>
    </div>
  );
}

function KudosButton({
  on,
  total,
  onToggle,
}: {
  on: boolean;
  total: number;
  onToggle: () => void;
}) {
  const [burst, setBurst] = useState(0);
  return (
    <button
      type="button"
      className={`btn sm kudos${on ? '' : ' line'}`}
      aria-pressed={on}
      disabled={on}
      onClick={() => {
        setBurst((b) => b + 1);
        onToggle();
      }}
    >
      {burst > 0 && (
        <span key={burst} className="kudos__burst" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />
          ))}
        </span>
      )}
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden className="kudos__heart">
        <path
          d="M8 14S2 10.2 2 6.1A3.1 3.1 0 0 1 8 4.6a3.1 3.1 0 0 1 6 1.5C14 10.2 8 14 8 14z"
          fill={on ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      Kudos{total > 0 && <span className="kudos__n">{total}</span>}
    </button>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="dossier__link">
      {children}
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path d="M5 11l6-6M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </a>
  );
}

export default ProfileModal;
