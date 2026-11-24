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
    <span className="diff-empty">—</span>
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
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const list = office.profileRequests ?? [];
  if (!list.length) return <p className="rc-none empty-state">No change requests waiting.</p>;

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
    <div className="requests-container">
      <div className="requests-list">
        {list.map((r) => {
          const fields = PROFILE_FIELDS.filter(([k]) => k in r.changes) as (readonly [
            ProfileField,
            string,
          ])[];
          const face = members.find((m) => m.id === r.user)?.avatar_url;
          const isOpen = openIds.has(r.id);
          const changeCount = fields.length;

          return (
            <article key={r.id} className={`request-card${isOpen ? ' is-open' : ''}`}>
              <div className="card-header" onClick={() => toggleOpen(r.id)} style={{ cursor: 'pointer' }}>
                {face ? (
                  <img className="avatar-img" src={face} alt={r.name} width={48} height={48} />
                ) : (
                  <div className="avatar">
                    {r.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                )}
                <div className="user-info" style={{ flexGrow: 1 }}>
                  <div className="user-header-row">
                    <span className="user-name">{r.name}</span>
                    <span className="request-time">asked {ago(r.at)}</span>
                    <button
                      type="button"
                      className="toggle-diff-btn"
                      aria-expanded={isOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOpen(r.id);
                      }}
                    >
                      <span className="chevron">{isOpen ? '▲' : '▼'}</span>
                      {isOpen ? 'Hide Details' : `${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`}
                    </button>
                  </div>
                  {r.note && <p className="user-quote">“{r.note}”</p>}
                </div>
              </div>

              {/* Collapsible Details Area */}
              <div className={`diff-collapsible${isOpen ? ' open' : ''}`}>
                <div className="diff-inner">
                  <div className="diff-table">
                    <div className="diff-header-row">
                      <div className="diff-th">Field</div>
                      <div className="diff-th">Current Value</div>
                      <div className="diff-th">Requested Change</div>
                    </div>

                    {fields.map(([k, label]) => {
                      const isPhoto = k === 'avatar_url';

                      return (
                        <div key={k} className="diff-row-contents">
                          <div className="diff-cell field-name">{label}</div>
                          <div className="diff-cell val-now">
                            {isPhoto ? (
                              face ? (
                                <img className="face" src={face} alt="Current" width={56} height={56} />
                              ) : (
                                <span className="diff-empty">None</span>
                              )
                            ) : (
                              show(r.current[k])
                            )}
                          </div>
                          <div className="diff-cell val-requested">
                            {isPhoto ? (
                              r.changes.avatar_url ? (
                                <img
                                  className="face"
                                  src={`/api/profile-requests/${r.id}/photo`}
                                  alt="Requested"
                                  width={56}
                                  height={56}
                                />
                              ) : (
                                <span className="bad">Remove photo</span>
                              )
                            ) : (
                              show(r.changes[k])
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <span className="footer-status-label">
                  Review Required · {changeCount} {changeCount === 1 ? 'Field' : 'Fields'}
                </span>
                <div className="action-buttons">
                  <button
                    className="btn btn-reject"
                    disabled={!!busy}
                    onClick={() => decide(r, 'rejected')}
                  >
                    Reject
                  </button>
                  <button
                    className="btn btn-approve"
                    disabled={!!busy}
                    onClick={() => decide(r, 'approved')}
                  >
                    {busy === r.id ? '…' : 'Approve'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
