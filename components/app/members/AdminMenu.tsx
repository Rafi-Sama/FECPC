"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/app/Store";
import { canFully } from "@/lib/permissions";

export function AdminMenu({
  userId,
  memberName,
  isAlumni,
  currentRoleLabel,
  onDone,
}: {
  userId: string;
  memberName: string;
  isAlumni: boolean;
  currentRoleLabel?: string | null;
  onDone?: () => void;
}) {
  const { s, me, act } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const canPromote = canFully(s.role, "member.promote");
  const canMakeAlumni = canFully(s.role, "member.makeAlumni");
  const canDeactivate = canFully(s.role, "member.deactivate");
  const allowed = (canPromote || canMakeAlumni || canDeactivate) && userId !== me.id;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!allowed) return null;

  const run = async (action: "promoteMember" | "makeAlumni" | "deactivateMember", confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const ok = await act(action, { userId });
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
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
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
      {open && (
        <div className="admin-menu__popover" role="menu" aria-label={`Manage ${memberName}`}>
          {canPromote && (
            <button
              type="button"
              role="menuitem"
              className="admin-menu__item"
              disabled={busy || currentRoleLabel === "Mentor"}
              onClick={() => run("promoteMember")}
            >
              Promote to mentor
            </button>
          )}
          {canMakeAlumni && (
            <button
              type="button"
              role="menuitem"
              className="admin-menu__item"
              disabled={busy || isAlumni}
              onClick={() => run("makeAlumni")}
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
                  "deactivateMember",
                  `Deactivate ${memberName}? They will be signed out immediately and removed from the active roster.`
                )
              }
            >
              Deactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminMenu;
