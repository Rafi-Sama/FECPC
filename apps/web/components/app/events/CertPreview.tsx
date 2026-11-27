'use client';
import { useEffect, useRef, useState } from 'react';
import { CERT_H, CERT_W } from '@/lib/events';

/** A certificate's HTML at A4 landscape, scaled to the box's width. The sandbox keeps any script from running. */
export function CertPreview({ html, title }: { html: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / CERT_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className="relative w-full overflow-hidden [border:2px_solid_var(--line2)] [background:#fff]"
      style={{ aspectRatio: `${CERT_W} / ${CERT_H}` }}
    >
      {k > 0 && (
        <iframe
          title={title}
          sandbox=""
          srcDoc={html}
          tabIndex={-1}
          className="top-0 left-0 absolute [border:0] [transform-origin:0_0] pointer-events-none"
          style={{ width: CERT_W, height: CERT_H, transform: `scale(${k})` }}
        />
      )}
    </div>
  );
}
