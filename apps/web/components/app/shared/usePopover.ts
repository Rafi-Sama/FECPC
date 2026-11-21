'use client';
// A popover fixed to the viewport, so a scrolling parent (the board, a table, a modal) cannot clip it.
// Opens below its trigger, or above when there is no room. Closes on outside click, scroll or resize.
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export function usePopover(width: number, height: number) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!pos) return;
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setPos(null);
    };
    const close = () => setPos(null);
    document.addEventListener('mousedown', away);
    document.addEventListener('scroll', away, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = (trigger: HTMLElement) => {
    if (pos) return setPos(null);
    const r = trigger.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16));
    const below = r.bottom + 6 + height <= window.innerHeight || r.top < height + 6;
    setPos(below ? { top: r.bottom + 6, left } : { bottom: window.innerHeight - r.top + 6, left });
  };

  return { box, pos, open: !!pos, toggle, close: () => setPos(null) };
}
