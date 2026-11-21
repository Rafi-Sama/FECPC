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
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${CERT_W} / ${CERT_H}`,
        overflow: 'hidden',
        border: '2px solid var(--line2)',
        background: '#fff',
      }}
    >
      {k > 0 && (
        <iframe
          title={title}
          sandbox=""
          srcDoc={html}
          tabIndex={-1}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CERT_W,
            height: CERT_H,
            border: 0,
            transform: `scale(${k})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
