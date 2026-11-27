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
        className="[background:var(--hero)] [color:var(--hero-ink)] h-[104px] relative overflow-hidden [border-bottom:2px_solid_var(--line2)] flex items-start p-[16px_20px] [&::after]:[content:''] [&::after]:absolute [&::after]:inset-0 [&::after]:pointer-events-none [&::after]:[background:linear-gradient(_100deg,transparent_40%,rgba(255,255,255,0.28)_50%,transparent_60%_)] [&::after]:[transform:translateX(-120%)]"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:20px_20px] [-webkit-mask-image:linear-gradient(90deg,transparent_35%,#000)] [mask-image:linear-gradient(90deg,transparent_35%,#000)] pointer-events-none" />
        <div
          className="absolute -right-1.5 -top-5.5 [font-weight:900] text-[170px] leading-[0.85] [letter-spacing:-9px] [color:color-mix(in_srgb,var(--hero-ink)_7%,transparent)] [-webkit-text-stroke:2px_var(--hero-ink)] opacity-[0.5] pointer-events-none [user-select:none] [transform:translate(var(--mx,0px),var(--my,0px))] [transition:transform_0.25s_var(--ease)]"
          ref={wmRef}
        >
          {batchStr}
        </div>
        <div
          className="relative z-1 [font-family:var(--mono,'JetBrains_Mono',monospace)] text-[11px] [font-weight:700] tracking-[0.08em] uppercase [background:#111] text-white p-[4px_8px] [box-shadow:2px_2px_0_rgba(0,0,0,0.35)]"
          data-r
          style={{ '--i': 0 } as React.CSSProperties}
        >
          Alumni · Batch {alumnus.batch ?? batchStr}
        </div>
      </div>

      {/* Avatar overlapping banner */}
      <div
        className="absolute left-5 top-16 w-[84px] h-[84px] [background:var(--bg)] [border:2px_solid_var(--line2)] [box-shadow:4px_4px_0_var(--line2)] [display:grid] [place-items:center] z-2 [cursor:crosshair] [transition:transform_0.15s_var(--snap),box-shadow_0.15s] hover:[transform:translate(-2px,-2px)] hover:[box-shadow:7px_7px_0_var(--line2)] [&_svg]:w-[66%] [&_svg]:h-[66%] [&_svg]:[shape-rendering:crispEdges] [&_rect]:fill-hi [&_rect]:[transform-box:fill-box] [&_rect]:[transform-origin:center] [&:hover_rect]:[animation:miniWiggle_0.45s_var(--snap)_both] [&:hover_rect]:[animation-delay:calc(var(--p)_*_22ms)]"
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
            className="w-full h-full object-cover"
          />
        ) : (
          <svg viewBox="0 0 7 7">{pixelRects}</svg>
        )}
        <span className="absolute -right-1.5 -bottom-1.5 w-[14px] h-[14px] [background:#22c55e] [border:2px_solid_var(--line2)] [&::after]:[content:''] [&::after]:absolute [&::after]:-inset-1.25 [&::after]:[border:2px_solid_#22c55e] [.alumni-mini:hover_&::after]:[animation:miniPing_1.8s_var(--snap)_infinite]" />
      </div>

      {/* Content */}
      <div className="p-[60px_22px_20px] flex-1 flex flex-col">
        <h2
          className="[font-size:2rem] [font-weight:900] [letter-spacing:-1px] leading-[1.05] text-acc mb-1.5 [&_span]:inline-block"
          aria-label={alumnus.name}
        >
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

        <div
          className="text-[17px] [font-weight:500] mb-1.5 text-hi"
          data-r
          style={{ '--i': 4 } as React.CSSProperties}
        >
          <HighlightMatch text={roleTitle} query={highlightQuery} />
        </div>

        <div
          className="[font-family:var(--mono,'JetBrains_Mono',monospace)] text-[12px] [font-weight:700] tracking-[0.08em] uppercase text-mut mb-3.5 inline-flex items-center gap-2 [&::before]:[content:''] [&::before]:w-[8px] [&::before]:h-[8px] [&::before]:[background:var(--acc)] [&::before]:[border:1px_solid_var(--line2)] [&::before]:flex-none"
          data-r
          style={{ '--i': 5 } as React.CSSProperties}
        >
          <HighlightMatch text={company} query={highlightQuery} />
        </div>

        <div
          className="flex items-center gap-2 [font-family:var(--mono,'JetBrains_Mono',monospace)] text-[12px] text-dim uppercase tracking-[0.06em] mb-4 [&_svg]:w-[14px] [&_svg]:h-[14px] [&_svg]:[fill:none] [&_svg]:stroke-current [&_svg]:[stroke-width:2] [&_svg]:[transition:transform_0.2s_var(--snap)] [.alumni-mini:hover_&_svg]:[transform:translateY(-3px)]"
          data-r
          style={{ '--i': 6 } as React.CSSProperties}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <HighlightMatch text={location} query={highlightQuery} />
        </div>

        <div
          className="flex flex-wrap gap-2 mb-4.5"
          data-r
          style={{ '--i': 7 } as React.CSSProperties}
        >
          {skills.slice(0, 3).map((sk) => (
            <button
              key={sk}
              type="button"
              className="[font-family:var(--mono,'JetBrains_Mono',monospace)] [font-size:0.74rem] [font-weight:700] uppercase p-[6px_11px] [background:var(--bg)] [border:1px_solid_var(--line2)] cursor-pointer [transition:all_0.1s_var(--snap)] hover:[background:var(--hi)] hover:text-bg hover:[transform:translate(-2px,-2px)] hover:[box-shadow:3px_3px_0_var(--acc)] active:[transform:translate(1px,1px)] active:[box-shadow:none]"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {sk}
            </button>
          ))}
        </div>

        <div
          className="flex items-center justify-between gap-2.5 [border-top:1px_solid_var(--line)] pt-3.5 mt-auto max-[421px]:flex-col max-[421px]:items-start"
          data-r
          style={{ '--i': 8 } as React.CSSProperties}
        >
          <div
            className={`flex items-center gap-2 [font-family:var(--mono,'JetBrains_Mono',monospace)] text-[11px] [font-weight:700] uppercase tracking-[0.05em] text-hi [&.closed]:text-dim [&_i]:w-[10px] [&_i]:h-[10px] [&_i]:[background:var(--acc)] [&_i]:inline-block [&_i]:flex-none [.alumni-mini:hover_&_i]:[animation:miniBlink_1.2s_step-end_infinite] [&.closed_i]:[background:var(--dim)] [&&&.closed_i]:[animation:none] ${alumnus.available_for_questions ? '' : 'closed'}`}
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
