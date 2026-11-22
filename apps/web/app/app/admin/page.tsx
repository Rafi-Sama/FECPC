'use client';
import { useState } from 'react';
import { Denied, Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { can, canFully, matrix, roleName, roles, type Cap } from '@fecpc/contracts';
import { AdminExtra } from '@/components/app/admin/AdminExtra';
import { Recruit } from '@/components/app/admin/Recruit';
import { ProfileRequests } from '@/components/app/admin/ProfileRequests';
import { AuditLog } from '@/components/app/admin/AuditLog';

const hues = ['#3de1ff', '#ff8a3d', '#7ce38b', '#ff4d8d'];
const cell = (v: unknown) => (v === true ? '✓' : v ? String(v) : '–');

export default function Admin() {
  const { s, office, members, toast } = useStore();
  const caps = {
    apps: can(s.roles, 'application.approve'),
    roles: can(s.roles, 'roles.assign'),
    audit: can(s.roles, 'audit.view'),
    exp: can(s.roles, 'data.export'),
    edit: canFully(s.roles, 'member.editDetails'),
  };
  const tabs = [
    'Dashboard',
    ...(caps.apps ? ['Recruit'] : []),
    ...(caps.apps || caps.roles ? ['Members'] : []),
    ...(caps.edit ? ['Requests'] : []),
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
    pendingApps = (office.recruit?.applicants ?? []).filter((a) => a.status === 'pending').length;
  // Every tile is counted from live records; a role only gets the tiles it has the authority to act on.
  const tiles: [string, number, string][] = [
    [
      'Members',
      people.filter((m) => !m.suspended).length,
      `${people.filter((m) => m.suspended).length} suspended · ${people.filter((m) => m.pending).length} invited, not joined`,
    ],
    ...(caps.apps
      ? [['Applicants', pendingApps, 'waiting for a decision'] as [string, number, string]]
      : []),
    ...(office.profileRequests
      ? [
          ['Profile changes', office.profileRequests.length, 'waiting for a decision'] as [
            string,
            number,
            string,
          ],
        ]
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
      {cur === 'Recruit' && <Recruit />}
      {cur === 'Requests' && <ProfileRequests />}
      {cur === 'Permissions' && (
        <div className="stack">
          <p className="body" style={{ maxWidth: '70ch' }}>
            ✓ full · scope: only their own items · view: read only · propose: starts a decision that
            a second officer finishes. Posts are assigned from a member's ⋯ menu.
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
      {cur === 'Audit log' && <AuditLog />}
      <AdminExtra tab={cur} />
    </Page>
  );
}
