'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { InterviewTopic } from '@fecpc/contracts';
import { HighlightMatch } from './HighlightMatch';

// Shared with RoadmapEditor so both draw the same tree.
export const NODE_W = 200;
export const NODE_H = 92;
const GAP_X = 32;
const GAP_Y = 56;
const PAD = 24; // room for the editor's + buttons, which stick out of a box
const MIN_FIT = 0.5;

type TreeNode = { key: string; parentKey: string | null };
export type Box = { x: number; y: number };

/**
 * Tidy tree: leaves take consecutive slots left to right and every parent is centred over its
 * children. Sibling order is array order. A node whose parent is missing (e.g. filtered out by a
 * search) becomes a root.
 */
export function layoutTree(nodes: TreeNode[]): {
  pos: Map<string, Box>;
  width: number;
  height: number;
} {
  const keys = new Set(nodes.map((n) => n.key));
  const kids = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const p = n.parentKey && keys.has(n.parentKey) ? n.parentKey : null;
    kids.set(p, [...(kids.get(p) ?? []), n]);
  }
  const pos = new Map<string, Box>();
  let slot = 0;
  const place = (n: TreeNode, depth: number): number => {
    const cs = kids.get(n.key) ?? [];
    const x = cs.length
      ? (() => {
          const xs = cs.map((c) => place(c, depth + 1));
          return (xs[0]! + xs[xs.length - 1]!) / 2;
        })()
      : slot++ * (NODE_W + GAP_X);
    pos.set(n.key, { x: x + PAD, y: depth * (NODE_H + GAP_Y) + PAD });
    return x;
  };
  for (const r of kids.get(null) ?? []) place(r, 0);
  const boxes = [...pos.values()];
  return {
    pos,
    width: Math.max(...boxes.map((b) => b.x), 0) + NODE_W + PAD,
    height: Math.max(...boxes.map((b) => b.y), 0) + NODE_H + PAD,
  };
}

/** Parent bottom-centre to child top-centre, as an elbow. */
export function edgePath(p: Box, c: Box): string {
  const px = p.x + NODE_W / 2;
  const cx = c.x + NODE_W / 2;
  const y1 = p.y + NODE_H;
  const mid = y1 + GAP_Y / 2;
  return `M${px} ${y1}V${mid}H${cx}V${c.y}`;
}

const zoomBtn = {
  font: '500 14px Inter, Arial, sans-serif',
  minWidth: 36,
  minHeight: 36,
  padding: '0 8px',
  border: '2px solid var(--line2, #0B0B0B)',
  background: 'var(--panel, #F6F4EE)',
  color: 'var(--ink, #0B0B0B)',
  cursor: 'pointer',
} as const;

/** Scales its content to fit the available width (and most of the screen height); −/+ override. */
export function TreeFrame({
  width,
  height,
  children,
}: Readonly<{ width: number; height: number; children: ReactNode }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth - 2 * 16, h: window.innerHeight * 0.7 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = avail ? Math.max(MIN_FIT, Math.min(1, avail.w / width, avail.h / height)) : 1;
  const scale = zoom ?? fit;
  const step = (d: number) =>
    setZoom(Math.round(Math.min(1.5, Math.max(0.3, scale + d)) * 10) / 10);

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--panel, #F6F4EE)',
        border: '2px solid var(--line2, #0B0B0B)',
        marginBottom: 16,
      }}
    >
      <div
        role="group"
        aria-label="Zoom"
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 6, display: 'flex', gap: 4 }}
      >
        <button type="button" aria-label="Zoom out" onClick={() => step(-0.1)} style={zoomBtn}>
          −
        </button>
        <button
          type="button"
          aria-label="Fit to screen"
          title="Fit to screen"
          onClick={() => setZoom(null)}
          style={{ ...zoomBtn, minWidth: 64 }}
        >
          {zoom === null ? 'Fit' : `${Math.round(scale * 100)}%`}
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => step(0.1)} style={zoomBtn}>
          +
        </button>
      </div>
      <div ref={ref} style={{ overflow: 'auto', padding: '52px 16px 16px' }}>
        <div
          style={{
            position: 'relative',
            width: width * scale,
            height: height * scale,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TreeEdges({
  nodes,
  pos,
  width,
  height,
}: Readonly<{ nodes: TreeNode[]; pos: Map<string, Box>; width: number; height: number }>) {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {nodes.map((n) => {
        const p = n.parentKey ? pos.get(n.parentKey) : undefined;
        const c = pos.get(n.key);
        return p && c ? (
          <path
            key={n.key}
            d={edgePath(p, c)}
            fill="none"
            stroke="var(--line2, #0B0B0B)"
            strokeWidth="2"
          />
        ) : null;
      })}
    </svg>
  );
}

export function RoadmapTreeCanvas({
  topics,
  activeTopicId,
  onSelectTopic,
  highlightQuery = '',
}: {
  readonly topics: InterviewTopic[];
  readonly activeTopicId: number | null;
  readonly onSelectTopic: (topic: InterviewTopic) => void;
  readonly highlightQuery?: string;
}) {
  const nodes = topics.map((t) => ({
    key: String(t.id),
    parentKey: t.parent_id ? String(t.parent_id) : null,
    topic: t,
  }));
  const { pos, width, height } = layoutTree(nodes);

  return (
    <TreeFrame width={width} height={height}>
      <TreeEdges nodes={nodes} pos={pos} width={width} height={height} />
      {nodes.map(({ key, topic }) => {
        const b = pos.get(key);
        if (!b) return null;
        const isSelected = activeTopicId === topic.id;
        const total = Number(topic.totalCount || 0);
        const solved = Number(topic.solvedCount || 0);
        const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
        const done = total > 0 && solved === total;

        return (
          <button
            key={key}
            type="button"
            title={topic.description ? `${topic.name} — ${topic.description}` : topic.name}
            aria-pressed={isSelected}
            onClick={() => onSelectTopic(topic)}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              width: NODE_W,
              height: NODE_H,
              padding: '12px 16px',
              textAlign: 'left',
              display: 'block',
              border: isSelected
                ? '3px solid var(--acc, #1F3BFF)'
                : '2px solid var(--line2, #0B0B0B)',
              background: done ? 'var(--bg, #FFFFFF)' : 'var(--panel, #F6F4EE)',
              cursor: 'pointer',
              boxShadow: isSelected ? '4px 4px 0 var(--acc, #1F3BFF)' : 'none',
            }}
          >
            <span
              className="m"
              style={{
                display: 'block',
                font: '14px ui-monospace, Menlo, monospace',
                color: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--dim, #5F5F5F)',
                fontWeight: 600,
              }}
            >
              {total === 0 ? 'No problems yet' : `${solved}/${total} solved${done ? ' ✓' : ''}`}
            </span>
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
            <div
              className="pb"
              style={{ height: 8, background: 'var(--line, #DCD8CC)', marginTop: 10 }}
            >
              <i
                style={{
                  display: 'block',
                  height: '100%',
                  background: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--ink, #0D0D0B)',
                  width: `${pct}%`,
                }}
              />
            </div>
          </button>
        );
      })}
    </TreeFrame>
  );
}

export default RoadmapTreeCanvas;
