'use client';
import { useState } from 'react';
import { Denied, Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { can, canFully, matrix, roleName, roles, type Cap } from '@fecpc/contracts';
import { AdminExtra } from '@/components/app/admin/AdminExtra';
import { Recruit } from '@/components/app/admin/Recruit';
import { ProfileRequests } from '@/components/app/admin/ProfileRequests';
import { AuditLog } from '@/components/app/admin/AuditLog';
import { Dashboard } from '@/components/app/admin/Dashboard';
import { XpRates } from '@/components/app/admin/XpRates';

import { permissionMatrix } from '@/components/app/admin/ui';

const cell = (v: unknown) => (v === true ? '✓' : v ? String(v) : '–');

export default function Admin() {
  const { s, office } = useStore();
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
    ...(s.role === 'super_admin' ? ['XP'] : []),
  ];
  const [tab, setTab] = useState('Dashboard');
  if (!Object.values(caps).some(Boolean))
    return (
      <Page title="Admin panel">
        <Denied need="an executive role (Secretary, Treasurer, President or Super Admin)" />
      </Page>
    );
  const cur = tabs.includes(tab) ? tab : 'Dashboard';
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
      {cur === 'Dashboard' && <Dashboard go={setTab} exp={!!caps.exp} />}
      {cur === 'Dashboard' && office.suggestions && (
        <section className="panel mt-4">
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
      {cur === 'XP' && <XpRates />}
      {cur === 'Requests' && <ProfileRequests />}
      {cur === 'Permissions' && (
        <div className="stack">
          <p className="body max-w-[70ch]">
            ✓ full · scope: only their own items · view: read only · propose: starts a decision that
            a second officer finishes. Posts are assigned from a member's ⋯ menu.
          </p>
          <div className="scroll-x">
            <table className={permissionMatrix}>
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
