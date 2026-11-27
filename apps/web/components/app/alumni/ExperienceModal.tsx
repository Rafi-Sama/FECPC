'use client';
import React, { useEffect, useRef } from 'react';
import type { InterviewTip } from '@fecpc/contracts';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { rankFor } from '@fecpc/contracts';
import { MarkdownBody, relTime } from '@/components/app/shared/MarkdownEditor';
import { useStore } from '@/components/app/Store';
import { canFully } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ExperienceModal({
  tip,
  onClose,
  onDeleted,
}: {
  tip: InterviewTip;
  onClose: () => void;
  onDeleted?: (tipId: number) => void;
}) {
  const sure = useConfirm();
  const { me, s } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const canDelete = tip.author_id === me.id || canFully(s.roles, 'interview.roadmap.manage');

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap + Esc
  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleDelete = async () => {
    if (!(await sure('Are you sure you want to delete this tip?'))) return;
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteInterviewTip',
          tipId: tip.id,
        }),
      });

      if (res.ok) {
        onDeleted?.(tip.id);
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete tip', err);
    }
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="inset-0 p-5 fixed [background:rgba(11,_11,_11,_0.65)] z-[9999] flex items-center justify-center overflow-y-auto"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expModalTitle"
        className="py-9 px-8 w-full max-w-[680px] [background:var(--panel)] [border:2px_solid_var(--line2)] [box-shadow:8px_8px_0_var(--line2)] relative max-h-[90vh] overflow-y-auto"
      >
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="top-4 right-4 absolute [background:none] [border:none] [font-family:var(--mono)] text-[22px] cursor-pointer leading-[1] text-ink"
        >
          ✕
        </button>

        <div className="mb-2 [font-family:var(--mono)] text-[11px] font-bold uppercase tracking-[0.08em] text-acc">
          INTERVIEW EXPERIENCE
        </div>

        <h2
          id="expModalTitle"
          className="mt-0 mx-0 mb-4 text-[26px] font-bold leading-[1.25] text-ink"
        >
          {tip.title}
        </h2>

        {/* Author row */}
        <div className="pb-4 mb-6 flex items-center gap-3 [border-bottom:1px_solid_var(--line)]">
          <AvatarRing
            name={tip.author_name || 'Alumnus'}
            avatarUrl={tip.author_avatar}
            size={36}
            rank={rankFor(tip.author_rating)}
          />
          <div>
            <div className="font-semibold text-[14px]">{tip.author_name || 'Alumnus'}</div>
            <div className="mt-0.5 [font-family:var(--mono)] text-[11px] text-dim">
              {tip.created_at ? relTime(tip.created_at) : 'Recently'}
            </div>
          </div>

          {canDelete && (
            <button
              type="button"
              className="btn line sm ml-auto text-acc2 border-acc2 text-[11px] [font-family:var(--mono)] cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
        </div>

        {/* Markdown content */}
        <div className="text-[15px] leading-[1.65] text-ink">
          <MarkdownBody markdown={tip.body_md} />
        </div>
      </div>
    </div>
  );
}
