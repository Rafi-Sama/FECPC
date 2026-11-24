'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../Store';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A wide, brutalist modal for the organiser rail. `data-modal` tells the save bar that closing this
 * dialog is not the same as leaving the event form, so its Escape and backdrop keep working.
 */
export function EventModal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const { s } = useStore();
  const th = s?.flags?.dark ? 't-d' : 't-b';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // An in-app prompt (decline reason, confirm) sits above this modal and owns the keyboard.
      if (e.key !== 'Tab' || !box.current || document.querySelector('[data-prompt]')) return;
      const nodes = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      const first = nodes[0];
      const last = nodes.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      const outside = !active || !box.current.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  const target = document.getElementById('main') || document.body;

  return createPortal(
    <div
      className={`cm-backdrop evm-backdrop ${th}`}
      data-modal
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={box} className={`cm-modal evm-modal ev-detail${wide ? ' wide' : ''}`}>
        <div className="cm-modal-head evm-modal-head">
          <h2 className="h3">{title}</h2>
          <button
            ref={close}
            type="button"
            className="cm-modal-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="evm-modal-body">{children}</div>
      </div>
    </div>,
    target,
  );
}
