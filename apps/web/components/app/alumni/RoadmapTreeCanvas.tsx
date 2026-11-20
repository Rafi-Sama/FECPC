'use client';
import type { InterviewTopic } from '@fecpc/contracts';
import { HighlightMatch } from './HighlightMatch';

const TREE_SLOTS = [
  { left: 390, top: 32, label: 'Arrays and hashing' },
  { left: 160, top: 172, label: 'Two pointers' },
  { left: 620, top: 172, label: 'Stack & Binary search' },
  { left: 40, top: 312, label: 'Sliding window' },
  { left: 280, top: 312, label: 'Linked list' },
  { left: 620, top: 312, label: 'Trees and graphs' },
  { left: 280, top: 452, label: 'System design basics' },
  { left: 620, top: 452, label: 'Dynamic programming' },
];

export function RoadmapTreeCanvas({
  topics,
  activeTopicId,
  onSelectTopic,
  filterActive = false,
  highlightQuery = '',
}: {
  readonly topics: InterviewTopic[];
  readonly activeTopicId: number | null;
  readonly onSelectTopic: (topic: InterviewTopic) => void;
  readonly filterActive?: boolean;
  readonly highlightQuery?: string;
}) {
  return (
    <div
      className="pn"
      style={{
        padding: '24px 0',
        overflowX: 'auto',
        background: 'var(--panel, #F6F4EE)',
        border: '2px solid var(--line2, #0B0B0B)',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 1000,
          height: 580,
          margin: '0 auto',
        }}
      >
        {/* SVG Tree Connector Lines matching mockup d49847ae */}
        <svg
          aria-hidden="true"
          width="1000"
          height="580"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {/* Level 0 to Level 1 */}
          <path
            d="M500 124V148H270V172"
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />
          <path
            d="M500 124V148H730V172"
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />

          {/* Level 1 to Level 2 */}
          <path
            d="M270 264V288H150V312"
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />
          <path
            d="M270 264V288H390V312"
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />
          <path
            d="M730 264V288H730V312"
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />

          {/* Level 2 to Level 3 */}
          <path
            d="M390 404V428H390V452"
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />
          <path
            d="M730 404V428H730V452"
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />
        </svg>

        {/* Tree Node Buttons */}
        {TREE_SLOTS.map((slot, index) => {
          const topic =
            topics[index] ??
            (filterActive
              ? null
              : {
                  id: -(index + 1),
                  name: slot.label,
                  slug: `topic-${index + 1}`,
                  description: '',
                  sort_order: index,
                  totalCount: 0,
                  solvedCount: 0,
                });
          if (!topic) return null;

          const isSelected = activeTopicId === topic.id;
          const total = Number(topic.totalCount || 0);
          const solved = Number(topic.solvedCount || 0);
          const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

          return (
            <button
              key={topic.id || index}
              type="button"
              onClick={() => onSelectTopic(topic)}
              style={{
                position: 'absolute',
                left: slot.left,
                top: slot.top,
                width: 220,
                height: 92,
                padding: '12px 16px',
                textAlign: 'left',
                display: 'block',
                border: isSelected
                  ? '3px solid var(--acc, #1F3BFF)'
                  : '2px solid var(--line2, #0B0B0B)',
                background: 'var(--panel, #F6F4EE)',
                cursor: 'pointer',
                boxShadow: isSelected ? '4px 4px 0 var(--acc, #1F3BFF)' : 'none',
                transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
              }}
            >
              {/* Solved label */}
              <span
                className="m"
                style={{
                  display: 'block',
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--dim, #5F5F5F)',
                  fontWeight: 600,
                }}
              >
                {solved}/{total} solved
              </span>

              {/* Title */}
              <b
                style={{
                  fontSize: 16,
                  display: 'block',
                  marginTop: 2,
                  color: 'var(--ink, #0B0B0B)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <HighlightMatch text={topic.name} query={highlightQuery} />
              </b>

              {/* Mini progress bar */}
              <div
                className="pb"
                style={{
                  height: 8,
                  background: 'var(--line, #DCD8CC)',
                  marginTop: 10,
                  overflow: 'hidden',
                }}
              >
                <i
                  style={{
                    display: 'block',
                    height: '100%',
                    background: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--ink, #0D0D0B)',
                    width: `${pct}%`,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default RoadmapTreeCanvas;
