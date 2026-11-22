'use client';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { HandleBox, useJudge, VjudgeBox } from '@/components/app/Judge';
import { Heatmap, Line, Radar } from '@/components/app/Charts';
import { cfTitle } from '@fecpc/content/site';
import { sheet } from '@fecpc/content/member-area';
import {
  level,
  PROFILE_LABEL,
  rankFor,
  roleName,
  type MemberProfile,
  type ProfileField,
} from '@fecpc/contracts';
import { MemberFace } from '@/components/app/shared/MemberFace';
import { ProfileForm } from '@/components/app/members/ProfileForm';
import { printCv } from '@/lib/cv';

/** The member's full profile (with their private details), from the same read the Members page uses. */
function useMyProfile(id: string) {
  const [p, setP] = useState<MemberProfile | null>(null);
  const load = useCallback(async () => {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'getMemberProfile', userId: id }),
    }).catch(() => null);
    if (res?.ok) setP((await res.json()) as MemberProfile);
  }, [id]);
  useEffect(() => void load(), [load]);
  return [p, load] as const;
}

const since = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—';

/** One labelled detail; empty ones say so, so the member knows what is missing. */
function Detail({ k, v, href }: { k: string; v?: string | null; href?: string }) {
  return (
    <div className="pd">
      <dt>{k}</dt>
      <dd>
        {!v ? (
          <span className="dim">Not added</span>
        ) : href ? (
          <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            {v}
          </a>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}

function Password() {
  const [msg, setMsg] = useState<[boolean, string] | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget,
      d = Object.fromEntries(new FormData(f));
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      setMsg(
        res.ok
          ? [true, 'Password changed. Your other devices have been signed out.']
          : [false, (await res.json()).error ?? 'That did not work.'],
      );
      if (res.ok) f.reset();
    } catch {
      setMsg([false, 'You seem to be offline. Nothing was changed.']);
    }
  };
  return (
    <form className="panel c4 no-print" onSubmit={submit}>
      <p className="label">Change password</p>
      <label className="field">
        <span className="label">Current password</span>
        <input
          name="currentPassword"
          type="password"
          className="input"
          required
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        <span className="label">New password · at least 10 characters</span>
        <input
          name="newPassword"
          type="password"
          className="input"
          required
          minLength={10}
          maxLength={200}
          autoComplete="new-password"
        />
      </label>
      {msg && (
        <p className={`body ${msg[0] ? 'ok' : 'bad'}`} role="status">
          {msg[1]}
        </p>
      )}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }}>
        Change password
      </button>
    </form>
  );
}

export default function Profile() {
  const { s, me, counts, xp, act, profileRequest } = useStore();
  const [p, reload] = useMyProfile(me.id);
  useEffect(() => void reload(), [me, reload]); // an approved change arrives with fresh state
  const [editing, setEditing] = useState(false);
  // kudos on the profile itself, plus kudos on the member's milestones in the feed
  const profileKudos = counts.kudos?.[`member:${me.id}`] ?? 0;
  const kudos = profileKudos + s.milestoneKudosReceived;
  const { data, err } = useJudge();
  const days = data
    ? Array.from(
        { length: 364 },
        (_, i) =>
          data.days[new Date(Date.now() - (363 - i) * 864e5).toISOString().slice(0, 10)] ?? 0,
      )
    : [];
  const hist = data?.history ?? [];
  // Without a judge handle the radar shows what the member cleared on the club sheet, never made-up numbers.
  const tags: [string, number][] = data
    ? Object.entries(data.tags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t, n]): [string, number] => [t.length > 14 ? t.split(' ')[0]! : t, n])
    : [...new Set(sheet.map((x) => x.topic))].map((t) => [
        t.toLowerCase(),
        sheet.filter((x) => x.topic === t && s.solved.includes(x.id)).length,
      ]);
  const rating = data?.rating ?? me.rating,
    peak = data?.maxRating ?? me.peak,
    solved = data?.solved.length ?? me.solved,
    tier = rankFor(rating),
    lv = level(xp),
    active = days.filter(Boolean).length;
  const stats: [string, React.ReactNode, string, string?][] = [
    ['Rating', rating || '—', data?.rank ?? cfTitle(rating), rating ? tier.color : undefined],
    [
      'Peak',
      peak || '—',
      peak ? rankFor(peak).title : 'unrated',
      peak ? rankFor(peak).color : undefined,
    ],
    ['Solved', solved, 'problems'],
    ['Rated rounds', hist.length, data ? 'on Codeforces' : 'link a handle'],
    ['Streak', me.streak + (s.checkin ? 1 : 0), 'days'],
    ['Level', lv.lv, `${lv.title} · ${xp} XP`],
  ];
  return (
    <Page
      title={me.name}
      aside={
        <span className="row no-print" style={{ '--g': '8px' } as React.CSSProperties}>
          <button className="btn sm" disabled={!p} onClick={() => setEditing(true)}>
            Request a change
          </button>
          <button
            className="btn sm line"
            onClick={() =>
              printCv({
                name: me.name,
                photo: me.avatar_url ?? null,
                headline: `${me.role || roleName[s.role]} · ${me.dept} · Batch ${me.batch}`,
                member: `FECPC member FEC-${String(me.no).padStart(4, '0')} · since ${since(p?.joined)}`,
                accent: '#1f3bff', // the club's colour; tier colours like grey print poorly
                contact: [
                  ...(p?.email ? [{ label: p.email, href: `mailto:${p.email}` }] : []),
                  ...(p?.phone ? [{ label: p.phone, href: `tel:${p.phone}` }] : []),
                  ...(p?.location ? [{ label: p.location }] : []),
                  ...(p?.github_url ? [{ label: 'GitHub', href: p.github_url }] : []),
                  ...(p?.linkedin_url ? [{ label: 'LinkedIn', href: p.linkedin_url }] : []),
                ],
                bio: p?.bio ?? null,
                skills: p?.skills ?? [],
                experience: p?.experience ?? [],
                stats: stats.map(([k, v, sub]) => [k, String(v), sub]),
                handle: s.handle || null,
                history: hist,
                contests: data?.contests ?? [],
                club: 'FEC Programming Club',
              })
            }
          >
            Export CV as PDF
          </button>
        </span>
      }
    >
      {profileRequest && (
        <div className={`preq no-print ${profileRequest.status}`} role="status">
          <span>
            {profileRequest.status === 'pending' ? (
              <>
                <b>Change requested:</b>{' '}
                {Object.keys(profileRequest.changes)
                  .map((k) => PROFILE_LABEL[k as ProfileField] ?? k)
                  .join(', ')}
                . Waiting for the Secretary or President.
              </>
            ) : profileRequest.status === 'approved' ? (
              <>
                <b>Your change was approved</b> and is on your profile.
              </>
            ) : (
              <>
                <b>Your change was not approved:</b> {profileRequest.reason}
              </>
            )}
          </span>
          {profileRequest.status === 'pending' && (
            <button className="btn xs line" onClick={() => act('profileRequestCancel', {})}>
              Withdraw
            </button>
          )}
        </div>
      )}
      <div className="bento fill profile">
        <section className="c5 idcard" style={{ '--r': tier.color } as React.CSSProperties}>
          <button
            type="button"
            className="idcard-photo"
            onClick={() => setEditing(true)}
            disabled={!p}
            title={me.avatar_url ? 'Ask for a new photo' : 'Add a photo'}
          >
            <MemberFace
              url={me.avatar_url}
              name={me.name}
              size={132}
              fg={tier.color}
              bg="#1a1a17"
            />
            {!me.avatar_url && <span className="idcard-add no-print">+ Add photo</span>}
          </button>
          <div>
            <p className="label" style={{ opacity: 0.7 }}>
              FECPC · Member card
            </p>
            <strong>{me.name}</strong>
            <p className="mono" style={{ fontSize: 14, marginTop: 6 }}>
              {me.role || roleName[s.role]} · {me.dept} · Batch {me.batch}
            </p>
            <p className="mono" style={{ fontSize: 14, marginTop: 4, opacity: 0.8 }}>
              FEC-{String(me.no).padStart(4, '0')} · since {since(p?.joined)}
            </p>
            <p className="idcard-cf">
              {data ? (
                <a
                  href={`https://codeforces.com/profile/${data.handle}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.handle} · {data.rank}
                </a>
              ) : s.handle ? (
                `${s.handle} · ${err ? 'not found on Codeforces' : 'syncing…'}`
              ) : (
                'Codeforces not linked'
              )}
            </p>
            <p
              className="idcard-kudos"
              title={`${profileKudos} on profile · ${s.milestoneKudosReceived} on milestones`}
            >
              ♥ {kudos} kudos
            </p>
          </div>
          <dl className="idcard-dl">
            <Detail k="Email" v={p?.email} href={p?.email ? `mailto:${p.email}` : undefined} />
            <Detail k="Phone" v={p?.phone} href={p?.phone ? `tel:${p.phone}` : undefined} />
            <Detail k="Student ID" v={p?.student_id} />
            <Detail k="Location" v={p?.location} />
          </dl>
          {(p?.github_url || p?.linkedin_url) && (
            <p className="idcard-links">
              {p.github_url && (
                <a href={p.github_url} target="_blank" rel="noreferrer">
                  GitHub ↗
                </a>
              )}
              {p.linkedin_url && (
                <a href={p.linkedin_url} target="_blank" rel="noreferrer">
                  LinkedIn ↗
                </a>
              )}
            </p>
          )}
          <p className="idcard-private no-print">
            Email, phone and student ID: only you and the Secretary and President see these.
          </p>
        </section>
        <section className="panel c7">
          <div className="pstats">
            {stats.map(([k, v, sub, c]) => (
              <div key={k} style={c ? ({ '--r': c } as React.CSSProperties) : undefined}>
                <span className="label">{k}</span>
                <span className="stat">{v}</span>
                <span className="label">{sub}</span>
              </div>
            ))}
          </div>
          <p className="label">Rating history{data ? ` · ${data.handle}` : ''}</p>
          {data && hist.length > 1 ? (
            <>
              <Line pts={hist} />
              <div className="bars-x">
                <span>first contest · {hist[0]}</span>
                <span>now · {hist.at(-1)}</span>
              </div>
            </>
          ) : (
            <p className="body dim">
              {data
                ? 'Rated rounds will draw a line here.'
                : 'Link a Codeforces handle to draw your rating history.'}
            </p>
          )}
        </section>
        {p && (p.bio || p.skills.length > 0 || p.experience.length > 0) && (
          <section className="panel pdetails">
            <p className="label">About</p>
            {p.bio ? <p className="body pbio">{p.bio}</p> : null}
            {p.skills.length > 0 && (
              <div className="pskills">
                {p.skills.map((x) => (
                  <span key={x} className="tag">
                    {x}
                  </span>
                ))}
              </div>
            )}
            {p.experience.length > 0 && (
              <ul className="pexp">
                {p.experience.map((x, i) => (
                  <li key={i}>
                    <span className="label">{x.period}</span>
                    <strong>{x.role}</strong>
                    {x.summary && <span className="body">{x.summary}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section className="panel c8">
          <div className="row between">
            <p className="label">Solves, last 52 weeks</p>
            {data && (
              <span className="label">
                {days.reduce((a, b) => a + b, 0)} accepted · {active} active days
              </span>
            )}
          </div>
          {data ? (
            <>
              <Heatmap days={days} />
              <div className="bars-x">
                <span>a year ago</span>
                <span>less ▫ ▪ ■ more</span>
                <span>today</span>
              </div>
            </>
          ) : (
            <p className="body dim">Link a handle to fill this in from the judge.</p>
          )}
        </section>
        <section className="panel c4" style={{ alignItems: 'center' }}>
          <p className="label" style={{ alignSelf: 'flex-start' }}>
            Strongest topics{data ? '' : ' · club sheet'}
          </p>
          <Radar data={tags} />
        </section>
        {data && data.contests.length > 0 && (
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <p className="label">Recent rated rounds</p>
            <ul className="list">
              {data.contests.map((c) => (
                <li key={c.id}>
                  <span className="grow">
                    <strong>{c.name}</strong>
                    <br />
                    <span className="label">
                      {new Date(c.at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                  <span className="num">#{c.rank.toLocaleString()}</span>
                  <b
                    className={`num ${c.delta >= 0 ? 'ok' : 'bad'}`}
                    style={{ width: 56, textAlign: 'right' }}
                  >
                    {c.delta >= 0 ? '+' : ''}
                    {c.delta}
                  </b>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="panel c8 no-print">
          <p className="label">Judge handles</p>
          <HandleBox />
          <VjudgeBox />
        </div>
        <Password />
      </div>
      {editing && p && <ProfileForm profile={p} mode="request" onClose={() => setEditing(false)} />}
    </Page>
  );
}
