'use client';
// Admin → Requests: members' profile change requests. Approving applies the new values; rejecting tells the
// member why. Each card shows what is there now next to what was asked for.
import {
  PROFILE_FIELDS,
  type ProfileField,
  type ProfileRequestReview,
  type ProfileValue,
} from '@fecpc/contracts';
import { useState } from 'react';
import { useStore } from '../Store';
import { MemberFace } from '../shared/MemberFace';
import { useConfirm, usePrompt } from '../shared/PromptDialog';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 6e4);
  return m < 60
    ? `${Math.max(m, 1)} min ago`
    : m < 2880
      ? `${Math.round(m / 60)} h ago`
      : `${Math.round(m / 1440)} days ago`;
};
const show = (v: ProfileValue | undefined) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? (
    <span className="dim">empty</span>
  ) : Array.isArray(v) ? (
    v.join(', ')
  ) : (
    String(v)
  );

export function ProfileRequests() {
  const { office, members, act } = useStore();
  const sure = useConfirm(),
    ask = usePrompt();
  const [busy, setBusy] = useState('');
  const list = office.profileRequests ?? [];
  if (!list.length)
    return (
      <p className="p-8 text-center [color:var(--dim)] [border:1px_dashed_var(--line)]">
        No change requests waiting.
      </p>
    );

  const decide = async (r: ProfileRequestReview, to: 'approved' | 'rejected') => {
    let reason: string | null = null;
    if (to === 'approved') {
      if (!(await sure(`Apply ${r.name}'s changes?`, 'Their profile updates now.', 'Approve')))
        return;
    } else {
      reason = await ask({
        title: `Reject ${r.name}'s request?`,
        label: 'Why? The member sees this.',
        placeholder: 'e.g. the photo must show your face clearly',
        confirmLabel: 'Reject',
        minLength: 3,
        maxLength: 300,
        danger: true,
      });
      if (reason === null) return;
    }
    setBusy(r.id);
    await act('profileRequestDecide', { id: r.id, to, ...(reason ? { reason } : {}) });
    setBusy('');
  };

  return (
    <ul className="rc-apps">
      {list.map((r) => {
        const fields = PROFILE_FIELDS.filter(([k]) => k in r.changes) as (readonly [
          ProfileField,
          string,
        ])[];
        const face = members.find((m) => m.id === r.user)?.avatar_url;
        return (
          <li key={r.id} className="panel flex flex-col gap-3.5">
            <header className="[&>div]:flex [&>div]:flex-col flex items-center gap-3">
              <MemberFace url={face} name={r.name} size={44} />
              <div>
                <strong>{r.name}</strong>
                <span className="[color:var(--dim)] text-[14px]">asked {ago(r.at)}</span>
              </div>
            </header>
            {r.note && <p className="italic [color:var(--mut)]">“{r.note}”</p>}
            <table className="tbl [&_td]:align-middle [&_td]:wrap-anywhere">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Now</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(([k, label]) => (
                  <tr key={k}>
                    <td>{label}</td>
                    {k === 'avatar_url' ? (
                      <>
                        <td>
                          {face ? (
                            <img className="face" src={face} alt="Current" width={64} height={64} />
                          ) : (
                            show(null)
                          )}
                        </td>
                        <td>
                          {r.changes.avatar_url ? (
                            <img
                              className="face"
                              src={`/api/profile-requests/${r.id}/photo`}
                              alt="Requested"
                              width={64}
                              height={64}
                            />
                          ) : (
                            <span className="bad">remove the photo</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{show(r.current[k])}</td>
                        <td className="preq-new">{show(r.changes[k])}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rc-row-actions">
              <button className="btn sm" disabled={!!busy} onClick={() => decide(r, 'approved')}>
                {busy === r.id ? '…' : 'Approve'}
              </button>
              <button
                className="btn sm line"
                disabled={!!busy}
                onClick={() => decide(r, 'rejected')}
              >
                Reject
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
