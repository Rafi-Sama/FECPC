'use client';
import { SaveForm } from '@/components/app/SaveBar';
import React, { useEffect, useMemo, useState } from 'react';
import { Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { can, isCommittee } from '@fecpc/contracts';
import { balloonColor } from '@fecpc/content/training';
import { VjudgeBox } from '@/components/app/Judge';
import type { VjudgeContestData } from '@/app/api/vjudge/route';

type ConfiguredContest = {
  id: string;
  name: string;
  type: 'running' | 'previous';
  addedAt: string;
};

type Board = VjudgeContestData | { error: string } | null;
// Pulls a status colour toward the text colour: darker on paper, lighter on charcoal, readable on both.
const readable = (c: string) => `color-mix(in oklab, ${c}, var(--ink) 40%)`;

export default function ContestDay() {
  const { s, act } = useStore();

  // The scoreboard's contests are club-wide, chosen by `contest.run` holders and stored on the server.
  const registry = useMemo<ConfiguredContest[]>(() => {
    try {
      const r = JSON.parse(s.kv.contests ?? '');
      if (Array.isArray(r)) return r;
    } catch {}
    return [];
  }, [s.kv.contests]);
  const setRegistry = (next: (prev: ConfiguredContest[]) => ConfiguredContest[]) =>
    act('contestDay', { contests: next(registry) });

  const runningConfig = registry.find((c) => c.type === 'running');
  const previousConfigs = registry.filter((c) => c.type === 'previous');

  const [selectedPrevId, setSelectedPrevId] = useState<string>(previousConfigs[0]?.id ?? '');

  // Tabs — ADMIN SETUP only visible to cp_head, president, super_admin
  const isAdmin = !!can(s.roles, 'contest.run');
  const baseTabs = isAdmin
    ? (['RUNNING CONTEST', 'PREVIOUS CONTESTS', 'ADMIN SETUP'] as const)
    : (['RUNNING CONTEST', 'PREVIOUS CONTESTS'] as const);
  const runner =
    isCommittee(s.roles) || s.present.some((k) => /^vol:(Balloon|Print) runner$/.test(k));
  const logisticsTabs = ['BALLOONS'] as const;
  const allTabs = runner ? [...baseTabs, ...logisticsTabs] : baseTabs;

  const [tab, setTab] = useState<(typeof allTabs)[number]>('RUNNING CONTEST');

  // Contest data states
  const [runningData, setRunningData] = useState<Board>(null);
  const [runningLoading, setRunningLoading] = useState(true);

  const [prevData, setPrevData] = useState<Board>(null);
  const [prevLoading, setPrevLoading] = useState(true);

  // Filter search queries
  const [searchQuery, setSearchQuery] = useState('');

  // Admin form state
  const [adminInputId, setAdminInputId] = useState('');
  const [adminInputName, setAdminInputName] = useState('');
  const [adminInputType, setAdminInputType] = useState<'running' | 'previous'>('running');
  const [adminMsg, setAdminMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const load = (id: string, set: (d: Board) => void, busy: (b: boolean) => void) => {
    busy(true);
    fetch(`/api/vjudge?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then(set, () => set({ error: 'Could not reach the server.' }))
      .finally(() => busy(false));
  };
  const refreshContest = (id: string, isRunning: boolean) =>
    isRunning ? load(id, setRunningData, setRunningLoading) : load(id, setPrevData, setPrevLoading);
  useEffect(() => {
    if (runningConfig?.id) load(runningConfig.id, setRunningData, setRunningLoading);
    else {
      setRunningData(null);
      setRunningLoading(false);
    }
  }, [runningConfig?.id]);
  useEffect(() => {
    if (selectedPrevId) load(selectedPrevId, setPrevData, setPrevLoading);
    else {
      setPrevData(null);
      setPrevLoading(false);
    }
  }, [selectedPrevId]);

  // Admin: Add or update contest ID
  const handleAddContest = async () => {
    if (!adminInputId.trim()) {
      setAdminMsg({ text: 'Please enter a VJudge Contest ID or URL', error: true });
      return false;
    }

    // Extract ID from full URL (e.g. https://vjudge.net/contest/612840#rank)
    const match = adminInputId.match(/contest\/(?:rank\/single\/)?(\d+)/i);
    const cleanId = match ? match[1] : adminInputId.trim().replace(/\D/g, '');

    if (!cleanId || cleanId.length > 12) {
      setAdminMsg({
        text: 'Use a VJudge contest number (e.g. 612840) or its link.',
        error: true,
      });
      return false;
    }

    const title = adminInputName.trim().slice(0, 120) || `Contest #${cleanId}`;

    const ok = await setRegistry((prev) => {
      let updated = [...prev];
      if (adminInputType === 'running') {
        // Demote previous running to previous
        updated = updated.map((c) =>
          c.type === 'running' ? { ...c, type: 'previous' as const } : c,
        );
      }
      const existingIdx = updated.findIndex((c) => c.id === cleanId);
      const newEntry: ConfiguredContest = {
        id: cleanId,
        name: title,
        type: adminInputType,
        addedAt: new Date().toISOString().slice(0, 10),
      };

      if (existingIdx >= 0) {
        updated[existingIdx] = newEntry;
      } else {
        updated.unshift(newEntry);
      }
      return updated;
    });
    if (!ok) return false;

    setAdminMsg({ text: `Added VJudge contest #${cleanId}.`, error: false });
    setAdminInputId('');
    setAdminInputName('');

    if (adminInputType === 'running') {
      setTab('RUNNING CONTEST');
    } else {
      setSelectedPrevId(cleanId);
      setTab('PREVIOUS CONTESTS');
    }
    return true;
  };

  const handleSetAsRunning = (contestId: string) => {
    setRegistry((prev) =>
      prev.map((c) => ({
        ...c,
        type: c.id === contestId ? 'running' : 'previous',
      })),
    );
    setTab('RUNNING CONTEST');
  };

  const handleDeleteContest = (contestId: string) => {
    setRegistry((prev) => prev.filter((c) => c.id !== contestId));
  };

  const done = (id: string) => s.flags['cd:' + id];
  // One balloon per accepted problem on the running board, newest first; delivery is a shared committee switch.
  const balloons =
    runningData && !('error' in runningData)
      ? runningData.standings
          .flatMap((r) =>
            Object.entries(r.problems)
              .filter(([, c]) => c.solved)
              .map(([p, c]) => ({
                id: `b:${runningData.id}:${r.userId}:${p}`,
                team: r.nickname || r.username,
                p,
                first: !!c.isFirst,
                time: c.time ?? 0,
              })),
          )
          .sort((a, b) => b.time - a.time)
      : [];

  // Helper to render Leaderboard Table
  const renderLeaderboard = (data: Board, isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 0' }}>
          <p className="body">Scraping leaderboard from VJudge...</p>
        </div>
      );
    }

    if (!data || 'error' in data) {
      return (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 0' }}>
          <p className="body">
            {data
              ? data.error
              : isAdmin
                ? 'No contest set. Add one in Admin setup.'
                : 'No contest set yet.'}
          </p>
        </div>
      );
    }

    const filteredStandings = data.standings.filter(
      (r) =>
        r.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.nickname.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Contest Info Header Bar */}
        <div
          className="panel box"
          style={{
            border: '2px solid var(--ink)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: '20px 24px',
          }}
        >
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 className="h3" style={{ margin: 0, fontWeight: 700 }}>
                  {data.title}
                </h2>
                {data.isRunning ? (
                  <span
                    className="tag on"
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      borderColor: '#16a34a',
                      fontWeight: 700,
                    }}
                  >
                    ● LIVE
                  </span>
                ) : (
                  <span className="tag" style={{ fontWeight: 600 }}>
                    FINAL STANDINGS
                  </span>
                )}
              </div>
              <p className="label" style={{ marginTop: 6, color: 'var(--dim)' }}>
                CONTEST ID: <strong style={{ color: 'var(--hi)' }}>{data.id}</strong> ·{' '}
                {data.problems.length} PROBLEMS · {data.standings.length} TEAMS
              </p>
            </div>

            <div className="row" style={{ '--g': '10px' } as React.CSSProperties}>
              <button
                className="btn xs line"
                onClick={() => refreshContest(String(data.id), data.isRunning)}
                title="Sync fresh rankings from VJudge"
              >
                ↻ Refresh Standings
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ maxWidth: 360 }}>
            <input
              type="text"
              className="input"
              style={{ minHeight: 38, fontSize: 14 }}
              placeholder="Search team name or member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* The VJudge Scoreboard Table */}
        <div
          className="panel box flush"
          style={{
            border: '2px solid var(--ink)',
            overflowX: 'auto',
          }}
        >
          <table
            className="tbl board"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              minWidth: 900,
            }}
          >
            <thead>
              <tr style={{ background: 'color-mix(in srgb, var(--ink) 4%, var(--panel))' }}>
                <th style={{ width: 48, textAlign: 'center', padding: '12px 6px' }}>#</th>
                <th style={{ minWidth: 220, padding: '12px 14px' }}>TEAM / CONTESTANT</th>
                <th style={{ width: 68, textAlign: 'center', padding: '12px 8px' }}>SOLVED</th>
                <th style={{ width: 78, textAlign: 'center', padding: '12px 8px' }}>PENALTY</th>
                {data.problems.map((p) => {
                  const stat = data.problemStats[p];
                  return (
                    <th
                      key={p}
                      style={{
                        width: 74,
                        textAlign: 'center',
                        borderLeft: '1px solid var(--line2)',
                        padding: '8px 4px',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{p}</div>
                      <div
                        className="label"
                        style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}
                      >
                        {stat?.solvedCount ?? 0}/{stat?.totalAttempts ?? 0}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredStandings.map((row) => {
                const medal = ['#eab308', '#94a3b8', '#d97706'][row.rank - 1];
                const rankColor = medal && readable(medal);

                return (
                  <tr
                    key={row.userId}
                    style={{
                      borderBottom: '1px solid var(--line)',
                      background:
                        s.vjudge && row.username.toLowerCase() === s.vjudge.toLowerCase()
                          ? 'color-mix(in srgb, var(--acc) 10%, transparent)'
                          : undefined,
                    }}
                  >
                    {/* Rank */}
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 700,
                        fontFamily: 'var(--mono), monospace',
                        color: rankColor,
                        padding: '10px 4px',
                      }}
                    >
                      {row.rank}
                    </td>

                    {/* Team info */}
                    <td style={{ padding: '10px 14px' }}>
                      <strong style={{ fontSize: 15, display: 'block' }}>{row.username}</strong>
                      <span className="dim" style={{ fontSize: 12 }}>
                        {row.nickname}
                      </span>
                    </td>

                    {/* Solved */}
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                        fontFamily: 'var(--arcade), monospace',
                        color: row.solved > 0 ? 'var(--acc)' : 'var(--dim)',
                      }}
                    >
                      {row.solved}
                    </td>

                    {/* Penalty */}
                    <td
                      style={{
                        textAlign: 'center',
                        fontFamily: 'var(--mono), monospace',
                        fontSize: 14,
                        color: 'var(--mut)',
                      }}
                    >
                      {row.penalty}
                    </td>

                    {/* Problem Cells Styled Exactly Like VJudge */}
                    {data.problems.map((p) => {
                      const cell = row.problems[p];
                      if (!cell) {
                        return (
                          <td
                            key={p}
                            style={{
                              textAlign: 'center',
                              borderLeft: '1px solid var(--line)',
                              padding: '4px',
                            }}
                          >
                            <span style={{ color: 'var(--line2)' }}>·</span>
                          </td>
                        );
                      }

                      if (cell.solved) {
                        // First solve on this problem
                        if (cell.isFirst) {
                          return (
                            <td
                              key={p}
                              style={{
                                textAlign: 'center',
                                borderLeft: '1px solid var(--line)',
                                padding: '4px',
                                backgroundColor: '#15803d',
                                color: '#ffffff',
                              }}
                              title={`First solve! Solved at minute ${cell.time} with ${cell.attempts} failed tries`}
                            >
                              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>
                                {cell.attempts > 0 ? `+${cell.attempts}` : '+'}
                              </div>
                              <div style={{ fontSize: 11, opacity: 0.9 }}>{cell.time}m</div>
                            </td>
                          );
                        }

                        // Normal Accepted
                        return (
                          <td
                            key={p}
                            style={{
                              textAlign: 'center',
                              borderLeft: '1px solid var(--line)',
                              padding: '4px',
                              backgroundColor: 'rgba(34, 197, 94, 0.16)',
                              color: readable('#16a34a'),
                            }}
                            title={`Accepted at minute ${cell.time} with ${cell.attempts} failed tries`}
                          >
                            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>
                              {cell.attempts > 0 ? `+${cell.attempts}` : '+'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--dim)' }}>{cell.time}m</div>
                          </td>
                        );
                      }

                      if (cell.attempts > 0) {
                        if (cell.pending) {
                          // Pending / Frozen
                          return (
                            <td
                              key={p}
                              style={{
                                textAlign: 'center',
                                borderLeft: '1px solid var(--line)',
                                padding: '4px',
                                backgroundColor: 'rgba(245, 158, 11, 0.16)',
                                color: readable('#d97706'),
                              }}
                              title={`${cell.attempts} pending runs`}
                            >
                              <div style={{ fontWeight: 700, fontSize: 14 }}>?{cell.attempts}</div>
                            </td>
                          );
                        }

                        // Failed attempts (WA)
                        return (
                          <td
                            key={p}
                            style={{
                              textAlign: 'center',
                              borderLeft: '1px solid var(--line)',
                              padding: '4px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: readable('#dc2626'),
                            }}
                            title={`${cell.attempts} failed attempts`}
                          >
                            <div style={{ fontWeight: 700, fontSize: 14 }}>-{cell.attempts}</div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={p}
                          style={{
                            textAlign: 'center',
                            borderLeft: '1px solid var(--line)',
                            padding: '4px',
                          }}
                        >
                          <span style={{ color: 'var(--line2)' }}>·</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Bottom Summary Statistics Row */}
            <tfoot>
              <tr
                style={{
                  background: 'color-mix(in srgb, var(--ink) 4%, var(--panel))',
                  borderTop: '2px solid var(--line2)',
                }}
              >
                <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700 }}>
                  Solved / Attempts
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    fontWeight: 700,
                    fontFamily: 'var(--arcade), monospace',
                  }}
                >
                  {filteredStandings.reduce((sum, r) => sum + r.solved, 0)}
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--mono), monospace' }}>—</td>
                {data.problems.map((p) => {
                  const stat = data.problemStats[p];
                  return (
                    <td
                      key={p}
                      style={{
                        textAlign: 'center',
                        borderLeft: '1px solid var(--line2)',
                        padding: '8px 4px',
                        fontSize: 12,
                      }}
                    >
                      <strong>{stat?.solvedCount ?? 0}</strong>/{stat?.totalAttempts ?? 0}
                    </td>
                  );
                })}
              </tr>
              <tr
                style={{
                  background: 'color-mix(in srgb, var(--ink) 2%, var(--panel))',
                  fontSize: 11,
                }}
              >
                <td colSpan={4} style={{ padding: '8px 14px', color: 'var(--dim)' }}>
                  First Solver
                </td>
                {data.problems.map((p) => {
                  const stat = data.problemStats[p];
                  return (
                    <td
                      key={p}
                      style={{
                        textAlign: 'center',
                        borderLeft: '1px solid var(--line2)',
                        padding: '6px 2px',
                        color: 'var(--dim)',
                      }}
                      title={
                        stat?.firstSolver
                          ? `${stat.firstSolver.name} (${stat.firstSolver.time}m)`
                          : 'Not solved'
                      }
                    >
                      {stat?.firstSolver ? (
                        <span style={{ color: readable('#16a34a'), fontWeight: 600 }}>
                          {stat.firstSolver.time}m
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Page
      title="CONTEST DAY"
      aside={
        isAdmin ? (
          <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
            <button
              className={`btn sm ${tab === 'ADMIN SETUP' ? '' : 'line'}`}
              onClick={() => setTab('ADMIN SETUP')}
            >
              ⚙ Admin: Contest IDs
            </button>
          </div>
        ) : undefined
      }
    >
      <Tabs tabs={allTabs} value={tab} onChange={setTab} />

      {/* Tab 1: Running Club Contest */}
      {!s.vjudge && (tab === 'RUNNING CONTEST' || tab === 'PREVIOUS CONTESTS') && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <p className="body">Link your VJudge handle to find yourself on the board.</p>
          <VjudgeBox />
        </div>
      )}
      {tab === 'RUNNING CONTEST' && <div>{renderLeaderboard(runningData, runningLoading)}</div>}

      {/* Tab 2: Previous Contests */}
      {tab === 'PREVIOUS CONTESTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="panel box"
            style={{
              border: '2px solid var(--ink)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="label">SELECT CONTEST:</span>
              <div className="row" style={{ '--g': '6px' } as React.CSSProperties}>
                {previousConfigs.map((c) => (
                  <button
                    key={c.id}
                    className={`btn xs ${selectedPrevId === c.id ? '' : 'line'}`}
                    onClick={() => setSelectedPrevId(c.id)}
                  >
                    #{c.id} {c.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <span className="label" style={{ color: 'var(--dim)' }}>
              {previousConfigs.length} PREVIOUS CONTESTS RECORDED
            </span>
          </div>

          {renderLeaderboard(prevData, prevLoading)}
        </div>
      )}

      {/* Tab 3: Admin Section (Section for the admin to add contest id) */}
      {tab === 'ADMIN SETUP' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
          {/* Add Contest ID Box */}
          <div className="panel box" style={{ border: '2px solid var(--ink)', padding: 24 }}>
            <h2 className="h3" style={{ marginBottom: 6 }}>
              Admin Contest ID Manager
            </h2>
            <p className="body" style={{ marginBottom: 20, fontSize: 14, color: 'var(--dim)' }}>
              Add running or past club contests by entering a VJudge Contest ID or URL. Standings
              will be fetched and computed directly from{' '}
              <code>https://vjudge.net/contest/&lt;id&gt;#rank</code> and{' '}
              <code>https://vjudge.net/contest/rank/single/&lt;id&gt;</code>.
            </p>

            <SaveForm
              onSubmit={handleAddContest}
              label="Contest not added"
              saveLabel="Add contest to board"
              onDiscard={() => {
                setAdminInputId('');
                setAdminInputName('');
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div className="grid" style={{ '--min': '260px', gap: 16 } as React.CSSProperties}>
                <div className="field">
                  <label className="label">VJudge Contest ID or Link *</label>
                  <input
                    className="input"
                    placeholder="e.g. 612840 or https://vjudge.net/contest/612840#rank"
                    value={adminInputId}
                    onChange={(e) => setAdminInputId(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>

                <div className="field">
                  <label className="label">Contest Name (Optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. FECPC ICPC Selection Mock 2026"
                    value={adminInputName}
                    onChange={(e) => setAdminInputName(e.target.value)}
                    maxLength={120}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Contest Status Classification</label>
                <div
                  className="row"
                  style={{ '--g': '16px', accentColor: '#22c55e' } as React.CSSProperties}
                >
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="adminType"
                      checked={adminInputType === 'running'}
                      onChange={() => setAdminInputType('running')}
                    />
                    <strong>Set as Running Contest</strong> (Active Live Scoreboard)
                  </label>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="adminType"
                      checked={adminInputType === 'previous'}
                      onChange={() => setAdminInputType('previous')}
                    />
                    <span>Add to Previous Contests Archive</span>
                  </label>
                </div>
              </div>

              {adminMsg && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: adminMsg.error
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(34, 197, 94, 0.12)',
                    color: adminMsg.error ? '#dc2626' : '#16a34a',
                    border: '1px solid currentColor',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {adminMsg.text}
                </div>
              )}
            </SaveForm>
          </div>

          {/* Configured Contests List */}
          <div className="panel box" style={{ border: '2px solid var(--ink)', padding: 24 }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <p className="label">Configured VJudge Contests ({registry.length})</p>
              <span className="label">Direct VJudge Links</span>
            </div>

            <div className="scroll-x">
              <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Contest Name &amp; ID</th>
                    <th>VJudge Rank URL</th>
                    <th>Single API URL</th>
                    <th className="r">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.type === 'running' ? (
                          <span
                            className="tag on"
                            style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                          >
                            RUNNING
                          </span>
                        ) : (
                          <span className="tag">ARCHIVED</span>
                        )}
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                        <div className="label" style={{ fontSize: 11, marginTop: 2 }}>
                          ID: #{c.id}
                        </div>
                      </td>
                      <td>
                        <a
                          className="link acc"
                          href={`https://vjudge.net/contest/${c.id}#rank`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 13 }}
                        >
                          https://vjudge.net/contest/{c.id}#rank ↗
                        </a>
                      </td>
                      <td>
                        <a
                          className="link dim"
                          href={`https://vjudge.net/contest/rank/single/${c.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 13 }}
                        >
                          /rank/single/{c.id} ↗
                        </a>
                      </td>
                      <td className="r">
                        <div
                          className="row"
                          style={
                            { justifyContent: 'flex-end', '--g': '6px' } as React.CSSProperties
                          }
                        >
                          {c.type !== 'running' && (
                            <button
                              className="btn xs line"
                              onClick={() => handleSetAsRunning(c.id)}
                              title="Promote to active live contest"
                            >
                              Set Running
                            </button>
                          )}
                          <button
                            className="btn xs line"
                            style={{ color: 'var(--bad)' }}
                            onClick={() => handleDeleteContest(c.id)}
                            title="Remove from list"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Logistics Tab: Balloons, from the running board */}
      {tab === 'BALLOONS' && (
        <div className="list">
          {balloons.length === 0 && (
            <p className="body dim">
              {runningConfig ? 'No accepted problems yet.' : 'No running contest is set.'}
            </p>
          )}
          {balloons.map((b) => (
            <div key={b.id} style={{ opacity: done(b.id) ? 0.45 : 1 }}>
              <i
                aria-hidden
                className="balloon"
                style={{ background: balloonColor[b.p] ?? 'var(--acc)' }}
              />
              <span className="grow">
                <strong>{b.team}</strong>
                <br />
                <span className="label">
                  Problem {b.p}
                  {b.first ? ' · first solve' : ''} · {b.time} min
                </span>
              </span>
              {isCommittee(s.roles) && (
                <button
                  className={`btn xs ${done(b.id) ? 'line' : ''}`}
                  aria-pressed={!!done(b.id)}
                  onClick={() => act('flag', { key: 'cd:' + b.id, on: !done(b.id) })}
                >
                  {done(b.id) ? 'DELIVERED · UNDO' : 'DELIVER'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
