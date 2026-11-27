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
 * search) becomes a root. `horizontal`: depth runs left to right and leaves stack top to bottom.
 */
export function layoutTree(
  nodes: TreeNode[],
  horizontal = false,
): {
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
      : slot++ * (horizontal ? NODE_H + GAP_X : NODE_W + GAP_X);
    const d = depth * (horizontal ? NODE_W + GAP_Y : NODE_H + GAP_Y);
    pos.set(n.key, horizontal ? { x: d + PAD, y: x + PAD } : { x: x + PAD, y: d + PAD });
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

/** Parent bottom-centre to child top-centre (horizontal: right-middle to left-middle), as an elbow. */
export function edgePath(p: Box, c: Box, horizontal = false): string {
  if (horizontal) {
    const x1 = p.x + NODE_W;
    const mid = x1 + GAP_Y / 2;
    return `M${x1} ${p.y + NODE_H / 2}H${mid}V${c.y + NODE_H / 2}H${c.x}`;
  }
  const px = p.x + NODE_W / 2;
  const cx = c.x + NODE_W / 2;
  const y1 = p.y + NODE_H;
  const mid = y1 + GAP_Y / 2;
  return `M${px} ${y1}V${mid}H${cx}V${c.y}`;
}

const zoomBtn =
  '[font:500_14px_Inter,_Arial,_sans-serif] min-h-[36px] py-0 px-2 [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink cursor-pointer';

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
    <div className="mb-4 relative [background:var(--panel)] [border:2px_solid_var(--line2)]">
      <div role="group" aria-label="Zoom" className="top-2 right-2 absolute z-[6] flex gap-1">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => step(-0.1)}
          className={`${zoomBtn} min-w-[36px]`}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Fit to screen"
          title="Fit to screen"
          onClick={() => setZoom(null)}
          className={`${zoomBtn} min-w-[64px]`}
        >
          {zoom === null ? 'Fit' : `${Math.round(scale * 100)}%`}
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => step(0.1)}
          className={`${zoomBtn} min-w-[36px]`}
        >
          +
        </button>
      </div>
      <div ref={ref} className="pt-13 px-4 pb-4 overflow-auto">
        <div
          className="my-0 mx-auto relative"
          style={{ width: width * scale, height: height * scale }}
        >
          <div
            className="top-0 left-0 absolute [transform-origin:0_0]"
            style={{ width, height, transform: `scale(${scale})` }}
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
  horizontal = false,
}: Readonly<{
  nodes: TreeNode[];
  pos: Map<string, Box>;
  width: number;
  height: number;
  horizontal?: boolean;
}>) {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      className="inset-0 absolute pointer-events-none"
    >
      {nodes.map((n) => {
        const p = n.parentKey ? pos.get(n.parentKey) : undefined;
        const c = pos.get(n.key);
        return p && c ? (
          <path
            key={n.key}
            d={edgePath(p, c, horizontal)}
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
  horizontal = false,
}: {
  readonly horizontal?: boolean;
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
  const { pos, width, height } = layoutTree(nodes, horizontal);

  return (
    <TreeFrame width={width} height={height}>
      <TreeEdges nodes={nodes} pos={pos} width={width} height={height} horizontal={horizontal} />
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
            className="py-3 px-4 absolute text-left block cursor-pointer"
            style={{
              left: b.x,
              top: b.y,
              width: NODE_W,
              height: NODE_H,
              border: isSelected
                ? '3px solid var(--acc, #1F3BFF)'
                : '2px solid var(--line2, #0B0B0B)',
              background: done ? 'var(--bg, #FFFFFF)' : 'var(--panel, #F6F4EE)',
              boxShadow: isSelected ? '4px 4px 0 var(--acc, #1F3BFF)' : 'none',
            }}
          >
            <span
              className="m block [font:600_14px_ui-monospace,_Menlo,_monospace]"
              style={{ color: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--dim, #5F5F5F)' }}
            >
              {total === 0 ? 'No problems yet' : `${solved}/${total} solved${done ? ' ✓' : ''}`}
            </span>
            <b className="mt-0.5 text-[16px] block text-ink overflow-hidden text-ellipsis whitespace-nowrap">
              <HighlightMatch text={topic.name} query={highlightQuery} />
            </b>
            <div className="pb mt-2.5 h-[8px] [background:var(--line)]">
              <i
                className="block h-full"
                style={{
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
