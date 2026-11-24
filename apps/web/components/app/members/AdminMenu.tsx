'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/app/Store';
import { canFully } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

export function AdminMenu({
  userId,
  memberName,
  isAlumni,
  onDone,
}: {
  userId: string;
  memberName: string;
  isAlumni: boolean;
  onDone?: () => void;
}) {
  const sure = useConfirm();
  const { s, me, act, who } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const canMakeAlumni = canFully(s.roles, 'member.makeAlumni');
  const canDeactivate = canFully(s.roles, 'member.deactivate');
  const canEdit = canFully(s.roles, 'member.editDetails');
  const [form, setForm] = useState(false);
  const target = who(userId);
  // Rank rule the server applies: the top two are the Super Admin's.
  const roleKey = 'roleKey' in target ? target.roleKey : undefined,
    locked = (roleKey === 'president' || roleKey === 'super_admin') && s.role !== 'super_admin';
  const allowed = (canMakeAlumni || canDeactivate || canEdit) && userId !== me.id && !locked;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setForm(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!allowed) return null;

  const run = async (action: 'makeAlumni' | 'suspend', confirmMsg?: string) => {
    if (confirmMsg && !(await sure(confirmMsg))) return;
    setBusy(true);
    try {
      const ok = await act(action, action === 'suspend' ? { user: userId, on: true } : { userId });
      if (ok) {
        setOpen(false);
        onDone?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="admin-menu"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="admin-menu__trigger"
        aria-label={`Admin actions for ${memberName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && form && (
        <form
          className="admin-menu__popover"
          style={{ display: 'grid', gap: 8, padding: 12, minWidth: 260 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            setBusy(true);
            const ok = await act('profile', {
              user: userId,
              name: String(d.get('name')).trim(),
              dept: String(d.get('dept')).trim(),
              batch: Number(d.get('batch')),
            }).finally(() => setBusy(false));
            if (ok) {
              setOpen(false);
              setForm(false);
              onDone?.();
            }
          }}
        >
          <p className="label">Edit details · logged</p>
          <input
            className="input"
            name="name"
            aria-label="Name"
            defaultValue={target.name}
            required
            minLength={2}
            maxLength={80}
          />
          <input
            className="input"
            name="dept"
            aria-label="Department"
            defaultValue={'dept' in target ? target.dept : ''}
            required
            minLength={2}
            maxLength={20}
          />
          <input
            className="input"
            name="batch"
            aria-label="Batch"
            type="number"
            min={0}
            max={99}
            defaultValue={'batch' in target ? target.batch : ''}
            required
          />
          <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
            <button className="btn sm" disabled={busy}>
              Save
            </button>
            <button type="button" className="btn sm ghost" onClick={() => setForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {open && !form && (
        <div className="admin-menu__popover" role="menu" aria-label={`Manage ${memberName}`}>
          {canEdit && (
            <button
              type="button"
              role="menuitem"
              className="admin-menu__item"
              disabled={busy}
              onClick={() => setForm(true)}
            >
              Edit details
            </button>
          )}
          {canMakeAlumni && (
            <button
              type="button"
              role="menuitem"
              className="admin-menu__item"
              disabled={busy || isAlumni}
              onClick={() => run('makeAlumni')}
            >
              Make alumni
            </button>
          )}
          {canDeactivate && (
            <button
              type="button"
              role="menuitem"
              className="admin-menu__item admin-menu__item--danger"
              disabled={busy}
              onClick={() =>
                run(
                  'suspend',
                  `Suspend ${memberName}? They will be signed out immediately and removed from the active roster.`,
                )
              }
            >
              Suspend
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminMenu;
