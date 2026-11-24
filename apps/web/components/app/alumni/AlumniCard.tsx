'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { AlumniSummary } from '@fecpc/contracts';
import { HighlightMatch } from './HighlightMatch';

const PIXEL_GRID = ['..###..', '..###..', '#######', '.#####.', '...#...', '..#.#..', '..#.#..'];

export function AlumniCard({
  alumnus,
  onOpenProfile,
  highlightQuery,
}: {
  readonly alumnus: AlumniSummary;
  readonly isOwnCard?: boolean;
  readonly onOpenProfile: (id: string) => void;
  readonly onToggleSave?: (id: string) => Promise<boolean | void>;
  readonly highlightQuery?: string;
}) {
  const [go, setGo] = useState(false);

  const wmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setGo(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const batchStr =
    alumnus.batch !== null && alumnus.batch !== undefined ? String(alumnus.batch).slice(-2) : '16';

  const company =
    alumnus.role && alumnus.role.includes('·')
      ? alumnus.role.split('·')[1]?.trim()
      : alumnus.dept
        ? `Dept. of ${alumnus.dept}`
        : 'Tech Company';

  const roleTitle =
    alumnus.role && alumnus.role.includes('·')
      ? alumnus.role.split('·')[0]?.trim()
      : alumnus.role || 'Software Engineer';

  const location = alumnus.location || 'Dhaka · Hybrid';

  const skills =
    alumnus.skills && alumnus.skills.length > 0 ? alumnus.skills : ['CP', 'Systems', 'Graphs'];

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wmRef.current) return;
    const banner = e.currentTarget;
    const r = banner.getBoundingClientRect();
    wmRef.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - 0.5) * -18}px`);
    wmRef.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height - 0.5) * -12}px`);
  };

  const handlePointerLeave = () => {
    if (!wmRef.current) return;
    wmRef.current.style.setProperty('--mx', '0px');
    wmRef.current.style.setProperty('--my', '0px');
  };

  // Build pixel avatar SVG rects
  let pixelIndex = 0;
  const pixelRects: React.ReactNode[] = [];
  PIXEL_GRID.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === '#') {
        const p = pixelIndex++;
        pixelRects.push(
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="1"
            height="1"
            style={{ '--p': p } as React.CSSProperties}
          />,
        );
      }
    });
  });

  return (
    <article
      className={`alumni-mini enter ${go ? 'go' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={`${alumnus.name}, batch ${alumnus.batch ?? 'alumni'}, ${location}. Open profile.`}
      onClick={() => onOpenProfile(alumnus.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenProfile(alumnus.id);
        }
      }}
    >
      {/* Banner */}
      <div
        className="mini-banner"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div className="mini-banner-grid" />
        <div className="mini-wm" ref={wmRef}>
          {batchStr}
        </div>
        <div className="mini-tagline" data-r style={{ '--i': 0 } as React.CSSProperties}>
          Alumni · Batch {alumnus.batch ?? batchStr}
        </div>
      </div>

      {/* Avatar overlapping banner */}
      <div
        className="mini-avatar"
        data-r
        style={{ '--i': 1 } as React.CSSProperties}
        title="Hover me"
        onClick={(e) => e.stopPropagation()}
      >
        {alumnus.avatar_url ? (
          <img
            loading="lazy"
            decoding="async"
            src={alumnus.avatar_url}
            alt={alumnus.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <svg viewBox="0 0 7 7">{pixelRects}</svg>
        )}
        <span className="mini-live" />
      </div>

      {/* Content */}
      <div className="mini-content">
        <h2 className="mini-name" aria-label={alumnus.name}>
          {highlightQuery ? (
            <HighlightMatch text={alumnus.name} query={highlightQuery} />
          ) : (
            [...alumnus.name].map((ch, i) => (
              <span key={i} style={{ '--c': i } as React.CSSProperties} aria-hidden="true">
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))
          )}
        </h2>

        <div className="mini-role" data-r style={{ '--i': 4 } as React.CSSProperties}>
          <HighlightMatch text={roleTitle} query={highlightQuery} />
        </div>

        <div className="mini-company" data-r style={{ '--i': 5 } as React.CSSProperties}>
          <HighlightMatch text={company} query={highlightQuery} />
        </div>

        <div className="mini-loc" data-r style={{ '--i': 6 } as React.CSSProperties}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <HighlightMatch text={location} query={highlightQuery} />
        </div>

        <div className="mini-tags" data-r style={{ '--i': 7 } as React.CSSProperties}>
          {skills.slice(0, 3).map((sk) => (
            <button
              key={sk}
              type="button"
              className="mini-tag"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {sk}
            </button>
          ))}
        </div>

        <div className="mini-foot" data-r style={{ '--i': 8 } as React.CSSProperties}>
          <div
            className={`mini-open ${alumnus.available_for_questions ? '' : 'closed'}`}
            title={alumnus.available_for_questions ? 'Open to questions' : 'Not taking questions'}
          >
            <i />
            {alumnus.available_for_questions ? 'Open to questions' : 'Not taking questions'}
          </div>

          <a
            className="mini-view"
            href={`#alumni-${alumnus.id}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenProfile(alumnus.id);
            }}
          >
            View profile{' '}
            <b aria-hidden="true">
              <svg viewBox="0 0 16 12">
                <path d="M1 6h13M9 1l5 5-5 5" />
              </svg>
            </b>
          </a>
        </div>
      </div>
    </article>
  );
}

export default AlumniCard;
