'use client';
import React, { useState } from 'react';
import { AvatarRing, tierText } from '@/components/app/shared/RatingBadge';
import { rankFor } from '@fecpc/contracts';
import type { AlumniSummary } from '@fecpc/contracts';
import { HighlightMatch } from './HighlightMatch';

export function AlumniCard({
  alumnus,
  isOwnCard,
  onOpenProfile,
  onToggleSave,
  highlightQuery,
}: {
  readonly alumnus: AlumniSummary;
  readonly isOwnCard?: boolean;
  readonly onOpenProfile: (id: string) => void;
  readonly onToggleSave: (id: string) => Promise<boolean | void>;
  readonly highlightQuery?: string;
}) {
  const [saved, setSaved] = useState(Boolean(alumnus.saved));
  const [saving, setSaving] = useState(false);

  const rank = rankFor(alumnus.cf_rating || alumnus.rating);
  const tierColor = rank.color;
  const batchStr =
    alumnus.batch !== null && alumnus.batch !== undefined ? String(alumnus.batch).slice(-2) : 'AL';
  const company =
    alumnus.role && alumnus.role.includes('·')
      ? alumnus.role.split('·')[1]?.trim()
      : alumnus.dept
        ? `Dept. of ${alumnus.dept}`
        : '[Company]';
  const roleTitle =
    alumnus.role && alumnus.role.includes('·')
      ? alumnus.role.split('·')[0]?.trim()
      : alumnus.role || alumnus.title || 'Software Engineer';
  const location = alumnus.location || 'Dhaka';
  const skills =
    alumnus.skills && alumnus.skills.length > 0 ? alumnus.skills : ['Distributed systems', 'Cloud'];

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      const res = await onToggleSave(alumnus.id);
      if (typeof res === 'boolean') {
        setSaved(res);
      } else {
        setSaved((v) => !v);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className="alumni-card"
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
      style={{
        background: 'var(--panel, #F6F4EE)',
        border: '2px solid var(--line2, #0B0B0B)',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform 0.14s ease, box-shadow 0.14s ease',
      }}
    >
      {/* 72px Header Band */}
      <div
        style={{
          position: 'relative',
          height: 72,
          background: alumnus.available_for_questions
            ? 'var(--acc, #1F3BFF)'
            : 'var(--line2, #0B0B0B)',
          overflow: 'hidden',
        }}
      >
        {/* Ghost Batch Number */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 12,
            top: -12,
            font: '700 110px/1 Inter, Arial, sans-serif',
            letterSpacing: '-4px',
            color: 'transparent',
            WebkitTextStroke: alumnus.available_for_questions
              ? '1.5px rgba(255,255,255,.4)'
              : '1.5px rgba(255,255,255,.22)',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {batchStr}
        </span>

        {/* Source / Batch Label */}
        <span
          className="m"
          style={{
            position: 'absolute',
            left: 20,
            top: 16,
            color: 'var(--on, #FFFFFF)',
            font: '11px ui-monospace, Menlo, monospace',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            zIndex: 1,
          }}
        >
          Alumni · Batch {alumnus.batch ?? '—'}
        </span>
      </div>

      {/* Card Content with Overlapping Avatar Box */}
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Overlapping Avatar Box */}
        <div
          style={{
            marginTop: -32,
            background: 'var(--panel, #F6F4EE)',
            display: 'inline-block',
            padding: 4,
            lineHeight: 0,
            alignSelf: 'flex-start',
            zIndex: 2,
          }}
        >
          <div
            style={{
              border: `2px solid ${tierColor}`,
              padding: 2,
              flex: 'none',
              lineHeight: 0,
            }}
          >
            <AvatarRing
              name={alumnus.name}
              avatarUrl={alumnus.avatar_url}
              size={56}
              ringWidth={2}
              ringOffset={2}
              notched
              rank={rank}
            />
          </div>
        </div>

        {/* Name (tier-tinted) */}
        <div
          style={{
            fontSize: 19,
            fontWeight: 600,
            margin: '12px 0 2px',
            color: tierText(tierColor),
            lineHeight: 1.2,
          }}
        >
          <HighlightMatch text={alumnus.name} query={highlightQuery} />
        </div>

        {/* Role */}
        <div style={{ fontSize: 15, color: 'var(--ink, #0B0B0B)' }}>
          <HighlightMatch text={roleTitle} query={highlightQuery} />
        </div>

        {/* Company in mono .m */}
        <div
          className="m"
          style={{
            margin: '4px 0 12px',
            font: '11px ui-monospace, Menlo, monospace',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--dim, #5F5F5F)',
          }}
        >
          <HighlightMatch text={company} query={highlightQuery} />
        </div>

        {/* Location with SVG pin */}
        <div
          className="m"
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            marginBottom: 16,
            font: '11px ui-monospace, Menlo, monospace',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--dim, #5F5F5F)',
          }}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M8 14s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8z" />
            <circle cx="8" cy="6" r="1.8" />
          </svg>
          {location}
        </div>

        {/* Skills Tag Strip */}
        <div style={{ minHeight: 34, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {skills.slice(0, 3).map((sk) => (
            <span
              key={sk}
              className="tg"
              style={{
                display: 'inline-block',
                font: '11px ui-monospace, Menlo, monospace',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                border: '1px solid var(--line2, #0B0B0B)',
                padding: '4px 8px',
                margin: '0 6px 6px 0',
                background: 'var(--bg, #FFFFFF)',
                color: 'var(--ink, #0B0B0B)',
              }}
            >
              {sk}
            </span>
          ))}
        </div>

        {/* Card Footer Divider & Affordance */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--line, #CFCBBF)',
            paddingTop: 14,
            marginTop: 'auto',
          }}
        >
          {/* Status Left */}
          {alumnus.available_for_questions ? (
            <span
              className="m"
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                color: 'var(--ink, #0B0B0B)',
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              <i
                style={{
                  width: 10,
                  height: 10,
                  background: 'var(--acc, #1F3BFF)',
                  display: 'inline-block',
                }}
              />
              Open to questions
            </span>
          ) : (
            <span
              className="m"
              style={{
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
              }}
            >
              Not mentoring
            </span>
          )}

          {/* Right Actions: Save button + View Profile */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isOwnCard ? (
              <span
                className="pill"
                style={{
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  background: 'var(--ink, #0B0B0B)',
                  color: 'var(--on, #FFFFFF)',
                }}
              >
                YOU
              </span>
            ) : alumnus.available_for_questions ? (
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                style={{
                  font: '11px ui-monospace, Menlo, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  border: '1px solid var(--line2, #0B0B0B)',
                  padding: '3px 8px',
                  background: saved ? 'var(--ink, #0B0B0B)' : 'transparent',
                  color: saved ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                  cursor: 'pointer',
                }}
                aria-label={saved ? 'Remove save' : 'Save alumnus'}
              >
                {saved ? 'Saved ✓' : 'Save'}
              </button>
            ) : null}

            <span
              className="m"
              style={{
                color: 'var(--ink, #0B0B0B)',
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              View profile →
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default AlumniCard;
