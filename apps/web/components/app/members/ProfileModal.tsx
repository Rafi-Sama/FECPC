'use client';
import { KudosButton } from '@/components/app/shared/Kudos';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { useStore } from '@/components/app/Store';
import { RANKS, rankFor, canFully } from '@fecpc/contracts';
import type { MemberContestRow, MemberProfile, Rank } from '@fecpc/contracts';
import { AdminMenu } from './AdminMenu';
import { AlumniSection } from './AlumniSection';
import { ProfileForm } from './ProfileForm';

const sectionTitle =
  'm-0 font-label text-[12px] [font-weight:500] tracking-[0.14em] uppercase [color:var(--dim)]';

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
      className="profile-modal-backdrop fixed inset-0 z-80 [background:rgba(11,11,11,0.62)] flex items-center justify-center p-6 max-[640px]:p-0"
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
        <header className="[position:sticky] top-0 z-10 flex items-center justify-between gap-3 [border-bottom:1px_solid_var(--line)] [background:var(--panel)] flex-none p-[8px_12px_8px_22px]">
          <span className="font-label text-[12px] tracking-[0.14em] uppercase [color:var(--dim)]">
            {editing
              ? 'Edit profile'
              : profile
                ? `FEC-${String(profile.no).padStart(4, '0')}`
                : 'Member profile'}
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="min-w-[40px] min-h-[40px] p-0 [background:var(--panel)] [border:2px_solid_var(--line2)] text-hi text-[20px] leading-[1] cursor-pointer [display:grid] [place-items:center] t-b:border-[#0b0b0b] hover:border-acc hover:text-acc focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px]"
            aria-label="Close"
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--line2)_transparent]">
          {loading && !profile ? (
            <div className="p-[24px_22px] flex flex-col gap-3">
              <span className="h-[22px] w-[60%] [background:linear-gradient(_90deg,var(--line)_0%,color-mix(in_srgb,var(--line)_30%,transparent)_50%,var(--line)_100%_)] [&&]:[background-size:200%_100%] [animation:dossier-skel_1.2s_linear_infinite]" />
              <span className="h-[22px] [background:linear-gradient(_90deg,var(--line)_0%,color-mix(in_srgb,var(--line)_30%,transparent)_50%,var(--line)_100%_)] [&&]:[background-size:200%_100%] [animation:dossier-skel_1.2s_linear_infinite] w-[35%]" />
            </div>
          ) : error || !profile ? (
            <div className="p-[24px_22px] flex flex-col gap-3">
              <p className="body bad">{error || 'Member not found.'}</p>
            </div>
          ) : (
            <>
              <section className="[display:grid] grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-6 [align-items:end] p-[22px_22px_18px] [background:linear-gradient(_180deg,color-mix(in_srgb,var(--rank-color)_12%,transparent),transparent_85%_)] max-[701px]:grid-cols-[1fr] max-[701px]:gap-4.5">
                <div className="flex items-center gap-4.5 min-w-0">
                  <AvatarRing
                    name={profile.name}
                    avatarUrl={profile.avatar_url}
                    size={84}
                    ringWidth={3}
                    ringOffset={4}
                    notched
                    rank={rank}
                  />
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <h2 className="m-0 font-disp [font-size:clamp(26px,3.4vw,38px)] [font-weight:700] leading-[1.05] [letter-spacing:-0.03em] text-hi wrap-anywhere">
                      {profile.name}
                    </h2>
                    <p className="m-0 flex items-center gap-2 flex-wrap font-label text-[12px] tracking-[0.08em] uppercase [color:var(--mut)]">
                      {roleLabel} · {profile.dept} · Batch {profile.batch}
                      {profile.is_alumni && <span className="alumni-tag">Alumni</span>}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
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

              <div
                className="[display:grid] grid-cols-[repeat(4,minmax(0,1fr))] [border-top:1px_solid_var(--line)] [border-bottom:1px_solid_var(--line)] max-[701px]:grid-cols-[repeat(2,minmax(0,1fr))]"
                aria-label="Member statistics"
              >
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
                <div className="flex flex-col gap-5.5 p-[20px_22px_24px] min-w-0">
                  <section className="dossier__sec" aria-label="About">
                    <h3 className={sectionTitle}>About</h3>
                    {profile.bio ? (
                      <p className="m-0 max-w-[66ch] text-[15px] leading-[1.6] text-ink whitespace-pre-line wrap-anywhere">
                        {profile.bio}
                      </p>
                    ) : (
                      <p className="m-0 text-[15px] [color:var(--dim)]">
                        {isOwner ? 'Add a bio from Edit profile.' : 'No bio yet.'}
                      </p>
                    )}
                    {profile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
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
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-label text-[12px] tracking-[0.08em] uppercase [color:var(--dim)]">
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
                      <h3 className={sectionTitle}>Experience</h3>
                      <ol className="dossier__journey [list-style:none] m-0 p-[0_0_0_18px] [border-left:2px_solid_var(--line)] flex flex-col gap-4.5">
                        {profile.experience.map((exp, idx) => (
                          <li
                            key={`${exp.period}-${exp.role}-${idx}`}
                            style={{ '--i': idx } as CSSProperties}
                          >
                            <span className="font-label text-[12px] tracking-[0.08em] [color:var(--dim)]">
                              {exp.period}
                            </span>
                            <strong className="text-[17px] text-hi">{exp.role}</strong>
                            {exp.summary && (
                              <p className="m-0 max-w-[64ch] text-[15px] leading-[1.55] [color:var(--mut)]">
                                {exp.summary}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {profile.is_alumni && <AlumniSection profile={profile} onReload={loadProfile} />}
                </div>

                {(contests.length > 0 || profile.recent_activity.length > 0) && (
                  <aside className="flex flex-col gap-5.5 p-[20px_22px_24px] min-w-0 [border-left:1px_solid_var(--line)] max-[701px]:[border-left:0] max-[701px]:[border-top:1px_solid_var(--line)]">
                    {contests.length > 0 && (
                      <section className="dossier__sec" id="dossier-contests" aria-label="Contests">
                        <h3 className={sectionTitle}>Rating changes</h3>
                        <ContestChart rows={contests} />
                      </section>
                    )}
                    {profile.recent_activity.length > 0 && (
                      <section className="dossier__sec" aria-label="Recent activity">
                        <h3 className={sectionTitle}>Recent activity</h3>
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
          <footer className="[&_.btn:focus-visible]:[outline:2px_solid_var(--acc)] [&_.btn:focus-visible]:[outline-offset:2px] bottom-0 z-10 flex items-center justify-between gap-2.5 flex-wrap p-[12px_20px] [border-top:1px_solid_var(--line)] [background:var(--panel)] flex-none relative">
            {
              <>
                <div className="row [--g:8px]">
                  {isOwner ? (
                    <button type="button" className="btn sm" onClick={() => setEditing(true)}>
                      Request a change
                    </button>
                  ) : (
                    <KudosButton
                      size="sm"
                      given={hasKudos}
                      label={`Give kudos to ${profile?.name ?? 'this member'}`}
                      onGive={() => act('toggle', { list: 'kudos', id: kudosId, on: true })}
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
      <span className="[.dossier\_\_stat.is-link:hover_&]:text-acc font-label text-[12px] tracking-[0.1em] uppercase [color:var(--dim)] [transition:color_0.2s]">
        {label}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="dossier__stat is-link cursor-pointer [transition:background_0.2s] hover:[background:color-mix(in_srgb,var(--acc)_8%,transparent)] focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:-2px]"
      onClick={onClick}
    >
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
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2.5 min-h-[44px]">
        <span className="font-num text-[40px] [font-weight:700] leading-[1] [letter-spacing:-0.03em] [font-variant-numeric:tabular-nums] [color:var(--rank-text,var(--hi))] t-a:[color:color-mix(in_srgb,var(--rank-color)_70%,#ffffff)] t-c:[color:color-mix(in_srgb,var(--rank-color)_70%,#ffffff)] t-d:[color:color-mix(in_srgb,var(--rank-color)_70%,#ffffff)]">
          {rank.unrated ? '—' : shown}
        </span>
        <span className="font-label text-[12px] leading-[1.35] tracking-[0.05em] uppercase [color:var(--mut)]">
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
      <div
        className="[display:grid] grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-4 min-h-[52px] pb-2.5 [border-bottom:1px_solid_var(--line)]"
        aria-live="polite"
      >
        {cur && (
          <>
            <strong className="text-[16px] text-hi overflow-hidden text-ellipsis whitespace-nowrap">
              {cur.name}
            </strong>
            <span className="[grid-row:2] font-label text-[12px] tracking-[0.06em] uppercase [color:var(--dim)]">
              Rank #{cur.rank}
              {cur.date ? ` · ${cur.date}` : ''}
            </span>
            <span
              className={`[grid-row:1_/_span_2] [grid-column:2] self-center font-num text-[30px] [font-weight:700] [font-variant-numeric:tabular-nums] ${cur.delta >= 0 ? 'up' : 'down'}`}
            >
              {fmt(cur.delta)}
            </span>
          </>
        )}
      </div>
      <div
        className="focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:4px] [display:grid] [grid-auto-flow:column] [grid-auto-columns:minmax(6px,22px)] [justify-content:start] gap-[4px] h-[120px] p-[4px_0] [background:linear-gradient(var(--line),var(--line))_center_/_100%_1px_no-repeat]"
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
      <p className="m-0 font-label text-[12px] tracking-[0.06em] uppercase [color:var(--dim)]">
        Net over {rows.length} contest{rows.length === 1 ? '' : 's'}:{' '}
        <b className={net >= 0 ? 'up' : 'down'}>{fmt(net)}</b>
      </p>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.25 p-[3px_8px] [border:1px_solid_var(--line)] font-label text-[13px] text-ink [text-decoration:none] [transition:border-color_0.2s,color_0.2s,transform_0.3s_cubic-bezier(0.16,1,0.3,1)] hover:border-acc hover:text-acc hover:[transform:translateY(-1px)] [&:hover_svg]:[transform:translate(1px,-1px)] [&_svg]:[transition:transform_0.3s_cubic-bezier(0.16,1,0.3,1)]"
    >
      {children}
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path d="M5 11l6-6M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </a>
  );
}

export default ProfileModal;
