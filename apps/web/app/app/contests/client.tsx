'use client';
import React from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { useSolved } from '@/components/app/Judge';

export type ContestItem = {
  id: number;
  name: string;
  when: string;
  durationH: number;
};

// Categorized upsolve problems by contest
const upsolveContests = [
  {
    contestName: 'Codeforces Round #640 (Div. 4)',
    heldDate: 'HELD 14 NOV',
    problems: [
      {
        id: '1352C',
        index: 'C',
        name: 'K-th Not Divisible by n',
        url: 'https://codeforces.com/contest/1352/problem/C',
      },
      {
        id: '1352D',
        index: 'D',
        name: 'Alice, Bob and Candies',
        url: 'https://codeforces.com/contest/1352/problem/D',
      },
    ],
  },
  {
    contestName: 'Codeforces Round #170 (Div. 1)',
    heldDate: 'HELD 07 NOV',
    problems: [
      {
        id: '277A',
        index: 'A',
        name: 'Learning Languages',
        url: 'https://codeforces.com/contest/277/problem/A',
      },
    ],
  },
  {
    contestName: 'Codeforces Round #574 (Div. 2)',
    heldDate: 'HELD 31 OCT',
    problems: [
      {
        id: '1195B',
        index: 'B',
        name: 'Sport Mafia',
        url: 'https://codeforces.com/contest/1195/problem/B',
      },
      {
        id: '1195C',
        index: 'C',
        name: 'Basketball Exercise',
        url: 'https://codeforces.com/contest/1195/problem/C',
      },
    ],
  },
];

// Last 3 Codeforces contests for the club report
const reportContests = [
  { id: 'div2_14nov', name: 'Codeforces Round (Div. 2)', date: '14 NOV', totalProblems: 6 },
  { id: 'edu_07nov', name: 'Codeforces Educational Round', date: '07 NOV', totalProblems: 7 },
  { id: 'div3_31oct', name: 'Codeforces Round (Div. 3)', date: '31 OCT', totalProblems: 8 },
];

type MemberResult = {
  solved: number;
  rank: number;
  ratingDelta: number;
};

type MemberReport = {
  id: string;
  name: string;
  handle: string;
  results: Record<string, MemberResult | null>;
};

const memberReports: MemberReport[] = [
  {
    id: 'nadia',
    name: 'Nadia Rahman',
    handle: 'nadia_r',
    results: {
      div2_14nov: { solved: 5, rank: 212, ratingDelta: 38 },
      edu_07nov: { solved: 6, rank: 140, ratingDelta: 45 },
      div3_31oct: { solved: 7, rank: 98, ratingDelta: 22 },
    },
  },
  {
    id: 'tanvir',
    name: 'Tanvir Ahmed',
    handle: 'tnv.exe',
    results: {
      div2_14nov: { solved: 4, rank: 344, ratingDelta: 21 },
      edu_07nov: { solved: 5, rank: 410, ratingDelta: 12 },
      div3_31oct: { solved: 6, rank: 305, ratingDelta: -8 },
    },
  },
  {
    id: 'sadia',
    name: 'Sadia Islam',
    handle: 'sadia_codes',
    results: {
      div2_14nov: { solved: 3, rank: 801, ratingDelta: 12 },
      edu_07nov: { solved: 4, rank: 950, ratingDelta: -15 },
      div3_31oct: null,
    },
  },
  {
    id: 'rahim',
    name: 'Rahim Uddin',
    handle: 'rahim_u',
    results: {
      div2_14nov: { solved: 3, rank: 1120, ratingDelta: -6 },
      edu_07nov: { solved: 4, rank: 880, ratingDelta: 9 },
      div3_31oct: { solved: 5, rank: 700, ratingDelta: 17 },
    },
  },
  {
    id: 'tasnim',
    name: 'Tasnim Akter',
    handle: 'tasnim_a',
    results: {
      div2_14nov: { solved: 2, rank: 2890, ratingDelta: 54 },
      edu_07nov: { solved: 3, rank: 2400, ratingDelta: 30 },
      div3_31oct: { solved: 4, rank: 1900, ratingDelta: 11 },
    },
  },
];

export default function ContestsClient({ up }: { up: ContestItem[] }) {
  const { me } = useStore();
  const { isSolved } = useSolved();

  const formatDuration = (hours: number) => {
    if (hours >= 48) return `${Math.round(hours / 24)} DAYS`;
    if (Number.isInteger(hours)) return `${hours}H`;
    return `${hours}H`;
  };

  return (
    <Page title="Contests">
      <div className="bento">
        {/* Top Left: Upcoming Contests from Codeforces */}
        <section
          className="panel c6 box"
          style={{ border: '2px solid var(--ink)', alignSelf: 'stretch' }}
        >
          <p className="label" style={{ letterSpacing: '0.08em' }}>
            UPCOMING CONTESTS FROM CODEFORCES
          </p>
          <div className="list">
            {up.length === 0 && (
              <p className="body" style={{ padding: '12px 0' }}>
                Judge unreachable; no upcoming rounds to show right now.
              </p>
            )}
            {up.map((c) => (
              <a
                key={c.id}
                className="list-row-link"
                href={`https://codeforces.com/contests/${c.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 0',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span className="grow">
                  <span className="hi" style={{ fontSize: 16, fontWeight: 500, display: 'block' }}>
                    {c.name}
                  </span>
                  <span className="label" style={{ marginTop: 4, display: 'inline-block' }}>
                    <span className="acc" style={{ fontWeight: 600 }}>
                      {c.when}
                    </span>{' '}
                    · {formatDuration(c.durationH)}
                  </span>
                </span>
                <span
                  className="label"
                  style={{ color: 'var(--acc)', fontSize: 18, lineHeight: 1 }}
                >
                  ↗
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Top Right: Upsolve Queue (Categorized by Contest, No Checkboxes, Solved items leave automatically) */}
        <section
          className="panel c6 box"
          style={{ border: '2px solid var(--ink)', alignSelf: 'stretch' }}
        >
          <p className="label" style={{ letterSpacing: '0.08em' }}>
            UPSOLVE QUEUE
          </p>
          <p
            className="body"
            style={{ fontSize: 13, color: 'var(--dim)', marginTop: -4, marginBottom: 8 }}
          >
            Solved problems leave the list automatically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {upsolveContests.map((group) => {
              // Automatically hide problems that the user has already solved
              const remaining = group.problems.filter((p) => !isSolved(p.id));
              if (remaining.length === 0) return null;

              return (
                <div
                  key={group.contestName}
                  style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--hi)' }}>
                    {group.contestName}
                  </div>
                  <div
                    className="label"
                    style={{ fontSize: 12, color: 'var(--dim)', marginBlock: '3px 8px' }}
                  >
                    {group.heldDate}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {remaining.map((p) => (
                      <div key={p.id}>
                        <a
                          className="link hi"
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 15 }}
                        >
                          {p.index} · {p.name}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {upsolveContests.every((g) => g.problems.every((p) => isSolved(p.id))) && (
              <p
                className="body"
                style={{ color: 'var(--mut)', padding: '16px 0', textAlign: 'center' }}
              >
                Queue clear! All upsolve problems solved.
              </p>
            )}
          </div>
        </section>

        {/* Bottom: Codeforces Contest Report · Last 3 Contests */}
        <section
          className="panel box"
          style={{ gridColumn: '1 / -1', border: '2px solid var(--ink)' }}
        >
          <div className="row between" style={{ marginBottom: 16 }}>
            <p className="label" style={{ letterSpacing: '0.08em' }}>
              CODEFORCES CONTEST REPORT · LAST 3 CONTESTS
            </p>
            <span className="label" style={{ letterSpacing: '0.08em' }}>
              CLUB MEMBERS · {memberReports.length}
            </span>
          </div>

          <div className="scroll-x">
            <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: 'none', width: '24%' }}></th>
                  {reportContests.map((c) => (
                    <th
                      key={c.id}
                      colSpan={3}
                      style={{
                        borderLeft: '1px solid var(--line2)',
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--line)',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          textTransform: 'none',
                          color: 'var(--hi)',
                          fontSize: 14,
                        }}
                      >
                        {c.name}
                      </div>
                      <div
                        className="label"
                        style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}
                      >
                        {c.date} · {c.totalProblems} PROBLEMS
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th style={{ padding: '8px 12px', borderBottom: '2px solid var(--line2)' }}>
                    MEMBER
                  </th>
                  {reportContests.map((c) => (
                    <React.Fragment key={c.id}>
                      <th
                        className="r"
                        style={{
                          borderLeft: '1px solid var(--line2)',
                          padding: '8px 10px',
                          borderBottom: '2px solid var(--line2)',
                        }}
                      >
                        SOLVED
                      </th>
                      <th
                        className="r"
                        style={{ padding: '8px 10px', borderBottom: '2px solid var(--line2)' }}
                      >
                        RANK
                      </th>
                      <th
                        className="r"
                        style={{ padding: '8px 10px', borderBottom: '2px solid var(--line2)' }}
                      >
                        RATING Δ
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memberReports.map((m) => {
                  const isYou = m.id === me?.id || m.handle === me?.handle;
                  return (
                    <tr key={m.id} className={isYou ? 'you' : ''}>
                      <td className="hi" style={{ whiteSpace: 'nowrap', padding: '12px 12px' }}>
                        <strong>{m.name}</strong> <span className="dim">@{m.handle}</span>
                        {isYou && (
                          <span className="pill" style={{ marginLeft: 10 }}>
                            you
                          </span>
                        )}
                      </td>

                      {reportContests.map((c) => {
                        const res = m.results[c.id];
                        if (!res) {
                          return (
                            <React.Fragment key={c.id}>
                              <td
                                className="r dim"
                                style={{
                                  borderLeft: '1px solid var(--line)',
                                  padding: '12px 10px',
                                }}
                              >
                                —
                              </td>
                              <td className="r dim" style={{ padding: '12px 10px' }}>
                                —
                              </td>
                              <td className="r dim" style={{ padding: '12px 10px' }}>
                                —
                              </td>
                            </React.Fragment>
                          );
                        }

                        const d = res.ratingDelta;
                        return (
                          <React.Fragment key={c.id}>
                            <td
                              className="r num"
                              style={{
                                borderLeft: '1px solid var(--line)',
                                padding: '12px 10px',
                                fontWeight: 500,
                              }}
                            >
                              {res.solved}/{c.totalProblems}
                            </td>
                            <td className="r num" style={{ padding: '12px 10px' }}>
                              {res.rank.toLocaleString()}
                            </td>
                            <td
                              className={`r num ${d >= 0 ? 'acc' : 'bad'}`}
                              style={{
                                padding: '12px 10px',
                                fontWeight: 600,
                                color: d > 0 ? '#1f3bff' : d < 0 ? '#c4321c' : undefined,
                              }}
                            >
                              {d > 0 ? `+${d}` : d}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Page>
  );
}
