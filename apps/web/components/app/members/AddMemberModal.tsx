'use client';
// President and Super Admin add one person by email with their role or post already set; the server checks both.
import { useState } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { useStore } from '@/components/app/Store';
import { postableRoles, postName, posts, roleName } from '@fecpc/contracts';

export function AddMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { s, act } = useStore();
  const superAdmin = s.role === 'super_admin';
  const empty = { name: '', email: '', batch: '', dept: '', role: 'member', post: '' };
  const [v, setV] = useState(empty);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Add a member"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <SaveForm
        className="cm-modal max-w-[560px]"
        label="Member not added yet"
        saveLabel="Add and send link"
        onDiscard={() => {
          setV(empty);
          onClose();
        }}
        onSubmit={async () => {
          const ok = await act('addMember', {
            name: v.name.trim(),
            email: v.email.trim(),
            batch: Number(v.batch),
            dept: v.dept.trim(),
            role: v.role,
            ...(v.post ? { post: v.post } : {}),
          });
          if (ok) {
            setV(empty);
            onAdded();
            onClose();
          }
          return ok;
        }}
      >
        <div className="cm-modal-head">
          <h2 className="h3">Add a member</h2>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="body">
          They get an email with a one-time link. Setting a password signs them straight in with the
          role below.
        </p>
        <label className="field">
          <span className="label">Full name</span>
          <input
            className="input"
            required
            minLength={2}
            maxLength={80}
            value={v.name}
            onChange={set('name')}
            autoFocus
          />
        </label>
        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            required
            maxLength={200}
            value={v.email}
            onChange={set('email')}
            placeholder="name@example.com"
          />
        </label>
        <div className="grid [--min:160px] [--g:12px]">
          <label className="field">
            <span className="label">Batch</span>
            <input
              className="input"
              type="number"
              required
              min={1}
              max={99}
              value={v.batch}
              onChange={set('batch')}
              placeholder="e.g. 24"
            />
          </label>
          <label className="field">
            <span className="label">Department</span>
            <input
              className="input"
              required
              minLength={2}
              maxLength={40}
              value={v.dept}
              onChange={set('dept')}
              placeholder="e.g. CSE"
            />
          </label>
        </div>
        <div className="grid [--min:160px] [--g:12px]">
          {superAdmin && (
            <label className="field">
              <span className="label">Role</span>
              <select className="input" value={v.role} onChange={set('role')}>
                {postableRoles.map((r) => (
                  <option key={r} value={r}>
                    {roleName[r]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span className="label">Post (optional)</span>
            <select className="input" value={v.post} onChange={set('post')}>
              <option value="">No post</option>
              {posts.map((p) => (
                <option key={p} value={p}>
                  {postName[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row [--g:8px]">
          <button type="submit" className="btn sm">
            Add and send link
          </button>
          <button type="button" className="btn sm line" data-close onClick={onClose}>
            Cancel
          </button>
        </div>
      </SaveForm>
    </div>
  );
}
