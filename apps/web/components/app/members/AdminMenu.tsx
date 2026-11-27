'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/app/Store';
import { canFully } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const menuItem =
  'w-full text-left [background:none] [border:0] p-[8px_10px] font-body text-[13px] text-ink cursor-pointer whitespace-nowrap hover:[background:color-mix(in_srgb,var(--acc)_12%,transparent)] hover:text-acc hover:[outline:0] focus-visible:[background:color-mix(in_srgb,var(--acc)_12%,transparent)] focus-visible:text-acc focus-visible:[outline:0] disabled:opacity-[0.45] disabled:cursor-not-allowed';

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
      className="relative inline-flex"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="py-0 px-1.5 min-w-8 min-h-8 [background:none] border border-line2 text-ink [font-family:var(--mono),monospace] text-[15px] leading-[1] cursor-pointer [display:grid] [place-items:center] hover:border-acc hover:text-acc focus-visible:[outline:2px_solid_var(--acc)] focus-visible:outline-offset-[2px]"
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
          className="absolute right-0 top-[calc(100%_+_4px)] z-45 [background:var(--panel)] [border:2px_solid_var(--line2)] flex-col t-b:border-[#0b0b0b] t-b:[background:#f6f4ee] [display:grid] gap-2 p-3 min-w-[260px]"

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
          <div className="row [--g:8px]">
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
        <div
          className="absolute right-0 top-[calc(100%_+_4px)] z-45 min-w-[176px] [background:var(--panel)] [border:2px_solid_var(--line2)] p-[4px] flex flex-col gap-0.5 t-b:border-[#0b0b0b] t-b:[background:#f6f4ee]"
          role="menu"
          aria-label={`Manage ${memberName}`}
        >
          {canEdit && (
            <button
              type="button"
              role="menuitem"
              className={menuItem}
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
              className={menuItem}
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
              className="w-full text-left [background:none] [border:0] p-[8px_10px] font-body text-[13px] cursor-pointer whitespace-nowrap hover:[outline:0] focus-visible:[outline:0] disabled:opacity-[0.45] disabled:cursor-not-allowed text-bad hover:[background:color-mix(in_srgb,var(--bad)_12%,transparent)] hover:text-bad focus-visible:[background:color-mix(in_srgb,var(--bad)_12%,transparent)] focus-visible:text-bad"
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
