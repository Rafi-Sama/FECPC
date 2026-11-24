'use client';
import { rankFor, type ClubRounds } from '@fecpc/contracts';
import { cfUrl } from '@fecpc/content/member-area';
import { Page } from '@/components/app/Shell';
import { useMore } from '@/components/site/More';
import { useStore } from '@/components/app/Store';
import { HandleBox, useJudge, useSolved } from '@/components/app/Judge';

export type ContestItem = {
  id: number;
  name: string;
  when: string;
  start: number;
  durationH: number;
};

const css = (o: Record<string, string | number>) => o as React.CSSProperties;
// One colour per kind of round, so the list reads at a glance.
const kind = (name: string): [string, string] =>
  /Div\. ?1\b(?!.*Div\. ?2)/.test(name)
    ? ['Div 1', '#e5413a']
    : /Div\. ?1.*Div\. ?2/.test(name)
      ? ['Div 1+2', '#d6266f']
      : /Div\. ?2/.test(name)
        ? ['Div 2', '#2f5bff']
        : /Div\. ?3/.test(name)
          ? ['Div 3', '#12a150']
          : /Div\. ?4/.test(name)
            ? ['Div 4', '#0e9aa7']
            : /Educational/i.test(name)
              ? ['Educational', '#7c4dff']
              : ['Special', '#d98e00'];
const until = (ms: number) => {
  const h = (ms - Date.now()) / 36e5;
  return h < 1
    ? 'within the hour'
    : h < 48
      ? `in ${Math.round(h)}h`
      : `in ${Math.round(h / 24)} days`;
};
const dur = (h: number) => (h >= 48 ? `${Math.round(h / 24)} days` : `${h}h`);

export default function ContestsClient({
  up,
  members,
}: {
  up: ContestItem[];
  members: ClubRounds[];
}) {
  const { me } = useStore();
  const { data } = useJudge();
  const { isSolved } = useSolved();
  // The club report: the three newest rated rounds any member took part in, from each member's synced rounds.
  const rounds = new Map<number, { id: number; name: string; at: number }>();
  for (const m of members) for (const r of m.cf_contests ?? []) rounds.set(r.id, r);
  const report = [...rounds.values()].sort((a, b) => b.at - a.at).slice(0, 3);
  const row = (m: (typeof members)[number], id: number) => m.cf_contests?.find((r) => r.id === id);
  const people = members
    .filter((m) => report.some((r) => row(m, r.id)))
    .sort(
      (a, b) =>
        report.reduce((n, r) => n + (row(b, r.id)?.solved ?? 0), 0) -
        report.reduce((n, r) => n + (row(a, r.id)?.solved ?? 0), 0),
    );
  const [shown, more] = useMore(people, 50);

  return (
    <Page title="Contests">
      <div className="bento fill">
        <section className="panel c6">
          <p className="label">Upcoming on Codeforces</p>
          {up.length === 0 && <p className="body dim">Codeforces is not answering right now.</p>}
          <div className="cf-up">
            {up.map((c) => {
              const [k, color] = kind(c.name);
              return (
                <a
                  key={c.id}
                  href={`https://codeforces.com/contests/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={css({ '--k': color })}
                >
                  <span className="cf-kind">{k}</span>
                  <strong>{c.name}</strong>
                  <span className="cf-when">
                    {c.when} · {dur(c.durationH)}
                    <b>{until(c.start)}</b>
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="panel c6">
          <p className="label">Your upsolve queue · last 3 rated rounds</p>
          {!me.handle && !data ? (
            <>
              <p className="body">Link your Codeforces handle to see what to upsolve.</p>
              <HandleBox />
            </>
          ) : !data ? (
            <p className="body dim">Loading from Codeforces…</p>
          ) : data.contests.length === 0 ? (
            <p className="body dim">No rated rounds yet. Your first one will show up here.</p>
          ) : (
            <div className="cf-ups">
              {data.contests.map((c) => {
                const left = c.problems.filter((p) => !isSolved(p.id));
                const [, color] = kind(c.name);
                return (
                  <div key={c.id} style={css({ '--k': color })}>
                    <div className="row between" style={css({ '--g': '8px' })}>
                      <a
                        className="hi"
                        href={`https://codeforces.com/contest/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>{c.name}</strong>
                      </a>
                      <span className="label">
                        rank {c.rank.toLocaleString()} ·{' '}
                        <b className={c.delta >= 0 ? 'ok' : 'bad'}>
                          {c.delta >= 0 ? '+' : ''}
                          {c.delta}
                        </b>
                      </span>
                    </div>
                    {left.length === 0 ? (
                      <p className="body ok">All solved.</p>
                    ) : (
                      <div className="cf-probs">
                        {left.slice(0, 4).map((p) => (
                          <a
                            key={p.id}
                            href={cfUrl(p.id)}
                            target="_blank"
                            rel="noreferrer"
                            style={css({
                              '--r': p.rating ? rankFor(p.rating).color : 'var(--dim)',
                            })}
                          >
                            <b>{p.index}</b> {p.name}
                            {p.rating && <i>{p.rating}</i>}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="row between">
            <p className="label">Club in recent Codeforces rounds</p>
            <span className="label">{people.length} members took part</span>
          </div>
          {report.length === 0 ? (
            <p className="body dim">
              No club member with a linked handle took part in the last few rated rounds.
            </p>
          ) : (
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>member</th>
                    {report.map((r) => (
                      <th key={r.id} className="r" style={css({ color: kind(r.name)[1] })}>
                        <a
                          href={`https://codeforces.com/contest/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title={r.name}
                        >
                          {kind(r.name)[0]} ·{' '}
                          {new Date(r.at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.id} className={m.id === me.id ? 'you' : ''}>
                      <td className="hi">
                        <strong>{m.name}</strong>{' '}
                        <span style={css({ color: rankFor(m.cf_rating ?? 0).color })}>
                          @{m.handle}
                        </span>
                      </td>
                      {report.map((r) => {
                        const x = row(m, r.id);
                        return (
                          <td key={r.id} className="r num">
                            {x ? (
                              <>
                                <b>{x.solved} solved</b>{' '}
                                <span className="dim">#{x.rank.toLocaleString()}</span>{' '}
                                <b className={x.delta >= 0 ? 'ok' : 'bad'}>
                                  {x.delta >= 0 ? '+' : ''}
                                  {x.delta}
                                </b>
                              </>
                            ) : (
                              <span className="dim">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {more}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
