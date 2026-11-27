'use client';
// XP as a climb: the total is your altitude, each level a camp, the history a trail log of where the XP came from.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { LEVEL, level, xpRates, XP_RULES, type XpHistoryItem, type XpKey } from '@fecpc/contracts';
import { relTime } from '@/components/app/shared/MarkdownEditor';
import { lcg } from '@/lib/lcg';

type Data = {
  items: XpHistoryItem[];
  more: boolean;
  breakdown: { kind: XpKey; count: number; points: number }[];
};
type Group = (typeof XP_RULES)[number]['group'] | 'start' | 'rate';
const RULE = Object.fromEntries(XP_RULES.map((r) => [r.key, r])) as Record<
  XpKey,
  (typeof XP_RULES)[number]
>;
const GROUPS = [...new Set(XP_RULES.map((r) => r.group))];
const n = (x: number) => x.toLocaleString('en-US');

// One line icon per kind of XP, drawn in the nav icons' stroke.
const ICON: Record<Group, string> = {
  Training: 'M8 6l-5 6 5 6M16 6l5 6-5 6M13.5 4l-3 16',
  Habits: 'M12 3c1 4 6 5.5 6 11a6 6 0 01-12 0c0-3 2-4.5 2-7 2 1.5 3 3 3 5 1.5-1 2-3 1-9z',
  Club: 'M5 21V4M5 4h12l-2.5 4L17 12H5',
  Community: 'M4 5h16v11H9l-5 4V5z',
  Kudos: 'M12 20s-7-4.4-7-9.2A3.8 3.8 0 0112 8.5a3.8 3.8 0 017 2.3C19 15.6 12 20 12 20z',
  start: 'M3 20l6-10 4 6 3-4 5 8H3z',
  rate: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
};
const Icon = ({ g, size = 18 }: { g: Group; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={ICON[g]} />
  </svg>
);

const groupOf = (it: XpHistoryItem): Group =>
  it.note === 'start'
    ? 'start'
    : it.note === 'rate'
      ? 'rate'
      : (RULE[it.kind]?.group ?? 'Training');
const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString(),
    yday = new Date(Date.now() - 864e5).toDateString();
  return d.toDateString() === today
    ? 'Today'
    : d.toDateString() === yday
      ? 'Yesterday'
      : d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
};

async function load(before?: number): Promise<Data | null> {
  try {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'xpHistory', ...(before ? { before } : {}) }),
    });
    return res.ok ? ((await res.json()) as Data) : null;
  } catch {
    return null;
  }
}

/** Contour lines, a ridge and the trail from this level's camp to the next, with the climber `t` of the way up. */
function Terrain({ t, from, to }: { t: number; from: number; to: number }) {
  const W = 1000,
    H = 360;
  const art = useMemo(() => {
    const rnd = lcg(7331);
    // Contours: wavy lines stacked across the card, smoothed through their midpoints.
    const contours = Array.from({ length: 11 }, (_, k) => {
      const base = 30 + k * 30,
        amp = 10 + rnd() * 18,
        f = 1.5 + rnd() * 2.5,
        ph = rnd() * 6.28;
      const pts = Array.from({ length: 26 }, (_, i) => {
        const x = (i / 25) * W;
        return [x, base + amp * Math.sin((x / W) * f * 6.28 + ph) + (rnd() - 0.5) * 8] as const;
      });
      let d = `M${pts[0]![0]} ${pts[0]![1].toFixed(1)}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i]!,
          [nx, ny] = pts[i + 1]!;
        d += ` Q${x} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
      }
      return d;
    });
    // The ridge, peaking on the right, and a switchback trail up its face.
    const ridge = `M440 ${H} L470 330 L560 300 L620 312 L700 240 L760 258 L830 170 L870 186 L930 96 L960 110 L1000 90 L1000 ${H} Z`;
    // Switchbacks just under the ridge line, from this level's camp to the next one near the peak.
    const trail: [number, number][] = [
      [580, 342],
      [660, 330],
      [630, 312],
      [735, 296],
      [712, 272],
      [820, 238],
      [800, 214],
      [895, 186],
      [905, 148],
      [930, 106],
    ];
    return { contours, ridge, trail };
  }, []);

  // The climber: `t` of the trail's length from the base camp.
  const segs = art.trail.slice(1).map((p, i) => {
    const q = art.trail[i]!;
    return { a: q, b: p, len: Math.hypot(p[0] - q[0], p[1] - q[1]) };
  });
  let left = Math.max(0, Math.min(1, t)) * segs.reduce((a, s) => a + s.len, 0);
  let at = art.trail[0]!;
  for (const s of segs) {
    if (left <= s.len) {
      const k = s.len ? left / s.len : 0;
      at = [s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k];
      break;
    }
    left -= s.len;
    at = s.b;
  }
  const path = `M${art.trail.map((p) => p.join(' ')).join(' L')}`;
  const [base, top] = [art.trail[0]!, art.trail.at(-1)!];
  return (
    <svg
      className="climb-art"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden
    >
      <g className="climb-contours">
        {art.contours.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path className="climb-ridge" d={art.ridge} />
      <path className="climb-trail" d={path} />
      <path className="climb-done" d={path} pathLength={1} strokeDasharray={`${t} 1`} />
      {[
        { p: base, label: `LV ${from}` },
        { p: top, label: `LV ${to}` },
      ].map(({ p, label }) => (
        <g key={label} className="climb-camp" transform={`translate(${p[0]} ${p[1]})`}>
          <path d="M0 0V-34M0 -34h20l-5 6 5 6H0" />
          <text x="-8" y="-22" textAnchor="end">
            {label}
          </text>
        </g>
      ))}
      <g transform={`translate(${at[0]} ${at[1]})`}>
        <circle className="climb-pulse" r="14" />
        <circle className="climb-me" r="7" />
        <text className="climb-you" y="-16" textAnchor="middle">
          You
        </text>
      </g>
    </svg>
  );
}

export default function XpHistory() {
  const { s, xp, me } = useStore();
  const rates = xpRates(s.kv);
  const lv = level(xp);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reload when the total changes, so a new line shows up right after the action that earned it.
  const refresh = useCallback(async () => {
    const d = await load();
    if (d) setData(d);
    else setFailed(true);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, xp]);

  const older = async () => {
    const last = data?.items.at(-1);
    if (!last) return;
    setBusy(true);
    const d = await load(last.id);
    setBusy(false);
    if (d) setData((x) => x && { ...x, items: [...x.items, ...d.items], more: d.more });
  };

  // What was earned before history began is one opening line.
  const lines: XpHistoryItem[] = [];
  for (const it of data?.items ?? []) {
    const open = lines.at(-1);
    if (it.note === 'start' && open?.note === 'start' && open.at === it.at)
      lines[lines.length - 1] = { ...open, delta: open.delta + it.delta };
    else lines.push(it);
  }
  const days: [string, XpHistoryItem[]][] = [];
  for (const it of lines) {
    if (days.at(-1) && dayKey(days.at(-1)![1][0]!.at) === dayKey(it.at)) days.at(-1)![1].push(it);
    else days.push([dayLabel(it.at), [it]]);
  }
  const gained = (since: number) =>
    lines
      .filter((x) => x.note !== 'start' && Date.parse(x.at) >= since)
      .reduce((a, x) => a + x.delta, 0);
  const midnight = new Date(new Date().toDateString()).getTime();
  const today = gained(midnight),
    week = gained(midnight - 6 * 864e5);

  const by = new Map((data?.breakdown ?? []).map((b) => [b.kind, b]));
  const top = Math.max(1, ...[...by.values()].map((b) => b.points));
  const best = [...by.values()].sort((a, b) => b.points - a.points)[0];

  return (
    <Page title="XP">
      <section className="climb-hero">
        <Terrain t={lv.into / LEVEL} from={lv.lv} to={lv.lv + 1} />
        <div className="climb-copy">
          <p className="climb-total">
            {n(xp)}
            <span> XP</span>
          </p>
          <p className="climb-rank">
            <b>Level {lv.lv}</b> · {lv.title} · {me.name.split(' ')[0]}&apos;s climb
          </p>
          <div className="climb-progress">
            <div
              className="climb-bar"
              role="progressbar"
              aria-label={`Level ${lv.lv + 1}`}
              aria-valuemin={0}
              aria-valuemax={LEVEL}
              aria-valuenow={lv.into}
            >
              <i style={{ width: `${(lv.into / LEVEL) * 100}%` }} />
            </div>
            <span>
              <b>{n(LEVEL - lv.into)} XP</b> to level {lv.lv + 1}
            </span>
          </div>
          <dl className="climb-readouts">
            <div>
              <dt>Today</dt>
              <dd data-up={today > 0 || undefined}>{today > 0 ? `+${n(today)}` : n(today)}</dd>
            </div>
            <div>
              <dt>Last 7 days</dt>
              <dd data-up={week > 0 || undefined}>{week > 0 ? `+${n(week)}` : n(week)}</dd>
            </div>
            <div>
              <dt>Best source</dt>
              <dd className="climb-best">{best ? RULE[best.kind]?.label : '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="climb-grid">
        <section className="panel climb-log">
          <header className="climb-head">
            <h2 className="h3">Trail log</h2>
            <span className="label">every change to your XP</span>
          </header>
          {failed && !data ? (
            <p className="body">Could not load your trail. Reload the page to try again.</p>
          ) : !data ? (
            <p className="body dim">Loading…</p>
          ) : days.length === 0 ? (
            <p className="body">
              The trail starts here. Check in, solve a problem or cheer someone to take the first
              step.
            </p>
          ) : (
            <>
              {days.map(([d, list]) => (
                <div key={d + list[0]!.id} className="climb-day">
                  <p className="climb-daytag">
                    <span>{d}</span>
                    <b>
                      {(() => {
                        const sum = list
                          .filter((x) => x.note !== 'start')
                          .reduce((a, x) => a + x.delta, 0);
                        if (list.every((x) => x.note === 'start')) return null;
                        return `${sum >= 0 ? '+' : '−'}${n(Math.abs(sum))} XP`;
                      })()}
                    </b>
                  </p>
                  <ol>
                    {list.map((it) => {
                      const g = groupOf(it);
                      const rule = RULE[it.kind];
                      return (
                        <li key={it.id} data-g={g} data-down={it.delta < 0 || undefined}>
                          <span className="climb-node">
                            <Icon g={g} />
                          </span>
                          <span className="min-w-0">
                            <strong>
                              {it.note === 'start' ? 'Base camp' : (rule?.label ?? it.kind)}
                            </strong>
                            <small>
                              {it.note === 'start'
                                ? 'Everything earned before the trail log began'
                                : it.note === 'rate'
                                  ? 'XP amount changed by the Super Admin'
                                  : it.count
                                    ? `${it.count > 0 ? '+' : '−'}${Math.abs(it.count)} × ${rates[it.kind] ?? 0} XP`
                                    : ''}
                              {' · '}
                              <time
                                dateTime={it.at}
                                title={new Date(it.at).toLocaleString('en-GB')}
                              >
                                {relTime(it.at)}
                              </time>
                            </small>
                          </span>
                          <span className="climb-delta">
                            {it.delta > 0 ? '+' : '−'}
                            {n(Math.abs(it.delta))}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
              {data.more && (
                <button className="btn sm line mt-4" disabled={busy} onClick={() => void older()}>
                  {busy ? 'Loading…' : 'Show older'}
                </button>
              )}
            </>
          )}
        </section>

        <section className="panel climb-routes">
          <header className="climb-head">
            <h2 className="h3">Routes</h2>
            <span className="label">where your XP comes from</span>
          </header>
          {GROUPS.map((g) => (
            <div key={g} className="climb-route" data-g={g}>
              <p className="climb-route-name">
                <span className="climb-node">
                  <Icon g={g} />
                </span>
                {g}
              </p>
              <ul>
                {XP_RULES.filter((r) => r.group === g).map((r) => {
                  const b = by.get(r.key);
                  const pts = b?.points ?? 0;
                  return (
                    <li key={r.key} data-zero={pts ? undefined : ''}>
                      <span className="climb-route-label">
                        {r.label}
                        {b && b.count > 0 && <small> ×{n(b.count)}</small>}
                      </span>
                      <span className="climb-route-pts">
                        {pts ? n(pts) : `+${rates[r.key]} each`}
                      </span>
                      <span className="climb-route-bar" aria-hidden>
                        <i style={{ width: `${pts ? Math.max(3, (pts / top) * 100) : 0}%` }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="label mt-3">
            Kudos you give earn XP for your first {rates.kudosGivenCap}; feed upvotes count up to{' '}
            {rates.feedUpvoteDailyCap} a day.
          </p>
        </section>
      </div>
    </Page>
  );
}
