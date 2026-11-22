'use client';
import { useState } from 'react';
import { Denied, Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { can, matrix, roleName, roles, type Cap } from '@fecpc/contracts';
import { AdminExtra } from '@/components/app/admin/AdminExtra';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const hues = ['#3de1ff', '#ff8a3d', '#7ce38b', '#ff4d8d'];
const cell = (v: unknown) => (v === true ? '✓' : v ? String(v) : '–');

export default function Admin() {
  const sure = useConfirm();
  const { s, act, office, members, toast } = useStore();
  const applications = office.applications ?? [];
  const caps = {
    apps: can(s.roles, 'application.approve'),
    roles: can(s.roles, 'roles.assign'),
    audit: can(s.roles, 'audit.view'),
    exp: can(s.roles, 'data.export'),
  };
  const tabs = [
    'Dashboard',
    ...(caps.apps ? ['Applications'] : []),
    ...(caps.apps || caps.roles ? ['Members'] : []),
    'Permissions',
    ...(caps.audit ? ['Audit log'] : []),
  ];
  const [tab, setTab] = useState('Dashboard');
  if (!Object.values(caps).some(Boolean))
    return (
      <Page title="Admin panel">
        <Denied need="an executive role (Secretary, Treasurer, President or Super Admin)" />
      </Page>
    );
  const cur = tabs.includes(tab) ? tab : 'Dashboard';
  const people = members.filter((m) => m.id !== 'admin'),
    pendingApps = applications.filter((a) => s.apps[a.id] === 'pending').length;
  // Every tile is counted from live records; a role only gets the tiles it has the authority to act on.
  const tiles: [string, number, string][] = [
    [
      'Members',
      people.filter((m) => !m.suspended).length,
      `${people.filter((m) => m.suspended).length} suspended · ${people.filter((m) => m.pending).length} invited, not joined`,
    ],
    ...(caps.apps
      ? [['Applications', pendingApps, 'waiting for a decision'] as [string, number, string]]
      : []),
    ...(office.queue
      ? [
          [
            'Payments',
            office.queue.filter((q) => q.status === 'pending').length,
            'waiting for verification',
          ] as [string, number, string],
        ]
      : []),
    ...(office.expenses
      ? [
          [
            'Expenses',
            office.expenses.filter(
              (e) => e.status === 'pending' || e.status === 'sent to President',
            ).length,
            'waiting for a decision',
          ] as [string, number, string],
        ]
      : []),
  ];
  const download = async () => {
    const res = await fetch('/api/export/members');
    if (!res.ok) return toast((await res.json()).error ?? 'The export failed.', 'bad');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = 'members.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Page
      title={
        <>
          {cur}
          <span className="acc">.</span>
        </>
      }
    >
      <Tabs tabs={tabs} value={cur} onChange={setTab} />
      {cur === 'Dashboard' && (
        <div className="bento">
          {tiles.map(([l, v, d], i) => (
            <section
              key={l}
              className="panel c3 tile"
              style={{ '--hue': hues[i % hues.length] } as React.CSSProperties}
            >
              <p className="label">{l}</p>
              <p className="big">{v}</p>
              <p className="body">{d}</p>
            </section>
          ))}
          {caps.exp && (
            <section
              className="panel c4 tile"
              style={{ '--hue': '#ffd23f' } as React.CSSProperties}
            >
              <p className="label">Member list</p>
              <p className="body">Exports are written to the audit log.</p>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={download}>
                Export members (CSV)
              </button>
            </section>
          )}
        </div>
      )}
      {cur === 'Dashboard' && office.suggestions && (
        <section className="panel" style={{ marginTop: 16 }}>
          <p className="label">Anonymous suggestions · {office.suggestions.length}</p>
          {office.suggestions.length === 0 ? (
            <p className="body">None yet.</p>
          ) : (
            <ul className="list">
              {office.suggestions.slice(0, 20).map((m, i) => (
                <li key={i}>
                  <span className="grow">{m.body}</span>
                  <span className="label">
                    {new Date(m.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {cur === 'Applications' && applications.length === 0 && (
        <p className="body">No applications yet.</p>
      )}
      {cur === 'Applications' && (
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Applicant · open for their answers</th>
                <th>Dept · Batch</th>
                <th>Source</th>
                <th className="r">Decision</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => {
                const st = s.apps[a.id] === 'pending' ? '' : s.apps[a.id];
                return (
                  <tr key={a.id}>
                    <td>
                      <details>
                        <summary>
                          <strong>{a.name}</strong>
                        </summary>
                        <p className="body" style={{ marginTop: 8, maxWidth: '52ch' }}>
                          {a.why}
                        </p>
                        <p className="label" style={{ marginTop: 6 }}>
                          {a.email} · ID {a.sid}
                          {a.cf ? ` · @${a.cf}` : ''} · track {a.track}
                        </p>
                      </details>
                    </td>
                    <td>
                      {a.dept} · {a.batch}
                    </td>
                    <td>{a.src}</td>
                    <td className="r">
                      {st ? (
                        <span className={`pill ${st === 'accepted' ? 'ok' : 'bad'}`}>{st}</span>
                      ) : (
                        <span
                          className="row"
                          style={
                            {
                              '--g': '6px',
                              justifyContent: 'flex-end',
                              flexWrap: 'nowrap',
                            } as React.CSSProperties
                          }
                        >
                          <button
                            className="btn xs"
                            onClick={async () =>
                              (await sure(`Accept ${a.name}? This creates their account.`)) &&
                              act('decide', { kind: 'application', id: a.id, to: 'accepted' })
                            }
                          >
                            Accept
                          </button>
                          <button
                            className="btn xs line"
                            onClick={async () =>
                              (await sure(`Decline ${a.name}? This cannot be undone.`)) &&
                              act('decide', { kind: 'application', id: a.id, to: 'declined' })
                            }
                          >
                            Decline
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {cur === 'Permissions' && (
        <div className="stack">
          <p className="body" style={{ maxWidth: '70ch' }}>
            ✓ full · scope: only their own mentees · view: read only · propose: starts a decision
            that a second officer finishes. Posts are assigned from a member's ⋯ menu.
          </p>
          <div className="scroll-x">
            <table className="tbl matrix">
              <thead>
                <tr>
                  <th>Capability</th>
                  {roles.map((r) => (
                    <th key={r} className={r === s.role ? 'me' : ''}>
                      {roleName[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(matrix) as Cap[]).map((c) => (
                  <tr key={c}>
                    <td>{matrix[c].label}</td>
                    {roles.map((r) => (
                      <td key={r} className={r === s.role ? 'me' : ''}>
                        {cell(can(r, c))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {cur === 'Audit log' && (
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
              </tr>
            </thead>
            <tbody>
              {s.log.map((l, i) => (
                <tr key={i}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                    {l.t}
                  </td>
                  <td>{l.who}</td>
                  <td>{l.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminExtra tab={cur} />
    </Page>
  );
}
