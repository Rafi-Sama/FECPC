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
    <div className="[&_dt]:font-label [&_dt]:text-[14px] [&_dt]:opacity-[0.65] [&_dd]:m-[2px_0_0] [&_dd]:text-[15px] [&_dd]:wrap-anywhere [&_dd_a]:[color:inherit] [&_dd_a]:[text-decoration:underline] [&&_dd_a]:[text-decoration-color:var(--r)] [&_dd_a]:[text-underline-offset:3px] [&_dd_a:hover]:[color:var(--r)] [&_.dim]:opacity-[0.55] min-w-0">
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
      <button className="btn sm self-start">Change password</button>
    </form>
  );
}

export default function Profile() {
  const { s, me, counts, xp, act, profileRequest } = useStore();
  const [p, reload] = useMyProfile(me.id);
  useEffect(() => void reload(), [me, reload]); // an approved change arrives with fresh state
  const [editing, setEditing] = useState(false);
  // kudos on the profile itself, plus kudos on the member's milestones in the feed
  const kudos = counts.kudos?.[`member:${me.id}`] ?? 0; // every kudos received, wherever it was given
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
        <span className="row no-print [--g:8px]">
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
      <div className="bento fill items-stretch profile">
        <section
          className="min-[760px]:[grid-column:span_12] min-[1100px]:[grid-column:span_5] print:[grid-column:span_5]! [border:2px_solid_var(--ink)] [background:var(--ink)] text-bg [display:grid] [&_strong]:[font-weight:500] [&_strong]:[letter-spacing:-0.02em] [&_strong]:block max-w-[none] [box-shadow:6px_6px_0_var(--acc)] [&_.label]:[color:inherit] [&&]:[border-left:8px_solid_var(--r)] [align-content:center] print:[break-inside:avoid] print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact] [&_strong]:text-[32px] p-8 gap-7 grid-cols-[auto_minmax(0,1fr)] items-center max-[561px]:grid-cols-[1fr] max-[561px]:[justify-items:start]"
          style={{ '--r': tier.color } as React.CSSProperties}
        >
          <button
            type="button"
            className="relative p-0 [border:0] [background:none] cursor-pointer leading-[0] rounded-[50%] [outline:4px_solid_var(--r)] outline-offset-[4px] [&_>_svg]:rounded-[50%] focus-visible:[outline-color:var(--acc)]"
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
            {!me.avatar_url && (
              <span className="py-1 px-2.5 absolute left-[50%] -bottom-3.5 [transform:translateX(-50%)] whitespace-nowrap [background:var(--r)] text-[#0d0d0b] [font:600_14px/1.2_var(--f-label)] no-print">
                + Add photo
              </span>
            )}
          </button>
          <div>
            <p className="label opacity-70">FECPC · Member card</p>
            <strong>{me.name}</strong>
            <p className="mono text-[14px] mt-1.5">
              {me.role || roleName[s.role]} · {me.dept} · Batch {me.batch}
            </p>
            <p className="mono text-[14px] mt-1 opacity-80">
              FEC-{String(me.no).padStart(4, '0')} · since {since(p?.joined)}
            </p>
            <p className="mt-3 text-[15px] font-semibold [&_a]:[color:var(--r)] [&_a]:no-underline">
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
              className="py-[3px] px-2.5 inline-block mt-2.5 text-[15px] bg-[#e5413a] text-[#fff]"
              title="Kudos on your profile, ideas and milestones"
            >
              ♥ {kudos} kudos
            </p>
          </div>
          <dl className="[grid-column:1_/_-1] [display:grid] grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))] gap-[14px_20px] m-0 pt-5 [border-top:1px_solid_color-mix(in_srgb,var(--bg)_20%,transparent)]">
            <Detail k="Email" v={p?.email} href={p?.email ? `mailto:${p.email}` : undefined} />
            <Detail k="Phone" v={p?.phone} href={p?.phone ? `tel:${p.phone}` : undefined} />
            <Detail k="Student ID" v={p?.student_id} />
            <Detail k="Location" v={p?.location} />
          </dl>
          {(p?.github_url || p?.linkedin_url) && (
            <p className="[&_a]:p-[6px_12px] [&_a]:[border:1px_solid_color-mix(in_srgb,var(--bg)_35%,transparent)] [&_a]:[color:inherit] [&_a]:[font:600_14px/1_var(--f-label)] [&_a]:[text-decoration:none] [&_a:hover]:[border-color:var(--r)] [&_a:hover]:[color:var(--r)] [&_a:focus-visible]:[border-color:var(--r)] [&_a:focus-visible]:[color:var(--r)] [grid-column:1_/_-1] flex flex-wrap gap-2">
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
          <p className="col-span-full text-[14px] opacity-60 no-print">
            Email, phone and student ID: only you and the Secretary and President see these.
          </p>
        </section>
        <section className="panel min-[760px]:[grid-column:span_12] min-[1100px]:[grid-column:span_7] print:[grid-column:span_7]!">
          <div className="[&_.stat]:text-[28px] [&_.stat]:leading-[1.1] [&_.stat]:[color:color-mix(in_oklab,var(--r,var(--hi)),var(--ink)_15%)] [&>div]:[display:grid] [&>div]:gap-0.5 [&>div]:p-[10px_12px] [&>div]:[border-top:4px_solid_var(--r,var(--line2))] [&>div]:[background:color-mix(in_srgb,var(--r,var(--ink))_6%,transparent)] [display:grid] grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5 mb-2">
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
              <div className="flex justify-between [font:14px_var(--mono),monospace] [color:var(--dim)] mt-1.5">
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
          <section className="panel [grid-column:1_/_-1] flex flex-col gap-4">
            <p className="label">About</p>
            {p.bio ? <p className="body max-w-[75ch] whitespace-pre-wrap">{p.bio}</p> : null}
            {p.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((x) => (
                  <span key={x} className="tag">
                    {x}
                  </span>
                ))}
              </div>
            )}
            {p.experience.length > 0 && (
              <ul className="[&_li]:[display:grid] [&_li]:gap-0.5 [&_li]:pl-3 [&_li]:[border-left:3px_solid_var(--line2)] [display:grid] gap-3">
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
              <div className="flex justify-between [font:14px_var(--mono),monospace] [color:var(--dim)] mt-1.5">
                <span>a year ago</span>
                <span>less ▫ ▪ ■ more</span>
                <span>today</span>
              </div>
            </>
          ) : (
            <p className="body dim">Link a handle to fill this in from the judge.</p>
          )}
        </section>
        <section className="panel c4 items-center">
          <p className="label self-start">Strongest topics{data ? '' : ' · club sheet'}</p>
          <Radar data={tags} />
        </section>
        {data && data.contests.length > 0 && (
          <section className="panel col-span-full">
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
                  <b className={`num ${c.delta >= 0 ? 'ok' : 'bad'} w-[56px] text-right`}>
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
