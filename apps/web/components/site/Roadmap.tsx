import { roadmap } from '@fecpc/content/site';

// Skill tree: an SVG graph on wide screens, the same nodes as an ordered list on phones.
const pos: Record<string, [number, number]> = {
  cpp: [0, 133],
  stl: [203, 50],
  math: [203, 216],
  graphs: [406, 10],
  ds: [406, 123],
  dp: [609, 216],
  icpc: [812, 113],
};
const W = 186,
  H = 68;

export default function Roadmap({ done = [] as string[] }) {
  const state = (id: string) => {
    const n = roadmap.find((r) => r.id === id)!;
    return done.includes(id) ? 'done' : n.needs.every((d) => done.includes(d)) ? 'open' : 'locked';
  };
  return (
    <div className="roadmap">
      <svg
        viewBox="0 0 1000 300"
        aria-hidden
        className="[.roadmap_&]:w-full [.roadmap_&]:h-auto [.roadmap_&]:hidden [.roadmap_&]:overflow-visible min-[900px]:[.roadmap_&]:block"
      >
        {roadmap.flatMap((n) =>
          n.needs.map((d) => {
            const [x1, y1] = pos[d],
              [x2, y2] = pos[n.id],
              mx = x2 - 9;
            return (
              <path
                key={d + n.id}
                className={`[fill:none] [stroke:var(--line2)] [stroke-width:1.5] [stroke-dasharray:3_4] [&.lit]:[stroke:var(--acc)] [&.lit]:[stroke-dasharray:none] ${done.includes(d) ? 'lit' : ''}`}
                d={`M${x1 + W} ${y1 + H / 2}H${mx}V${y2 + H / 2}H${x2}`}
              />
            );
          }),
        )}
        {roadmap.map((n) => {
          const [x, y] = pos[n.id];
          return (
            <g key={n.id} className={`node ${state(n.id)}`} transform={`translate(${x} ${y})`}>
              <rect width={W} height={H} />
              <text
                x={12}
                y={28}
                className="[.node_&]:[fill:var(--ink)] [.node_&]:[font:500_15px_var(--sans),sans-serif] [.node_&]:tracking-[-0.01em] [.node.done_&]:[fill:var(--on)]"
              >
                {n.name}
              </text>
              <text
                x={12}
                y={50}
                className="[.node_&]:[fill:var(--mut)] [.node_&]:[font:14px_var(--mono),monospace] [.node.open_&]:[fill:var(--acc2)] [.node.done_&]:[fill:var(--on)]"
              >
                {state(n.id) === 'done'
                  ? '✓ complete'
                  : state(n.id) === 'open'
                    ? `start → ${n.weeks} weeks`
                    : 'locked'}
              </text>
            </g>
          );
        })}
      </svg>
      <ol className="flex flex-col [&_li]:py-4 [&_li]:px-0 [&_li]:[display:grid] [&_li]:grid-cols-[64px_minmax(0,1fr)] [&_li]:gap-[4px_14px] [&_li]:border-t [&_li]:border-t-line [&_.st]:text-[14px] [&_.st]:row-[span_2] [&_.st]:text-dim [&_.st]:pt-1 [&_.done_.st]:text-acc [&_.open_.st]:text-acc2 [&_strong]:text-[18px] [&_strong]:font-medium [&_.locked_strong]:text-dim min-[900px]:hidden">
        {roadmap.map((n) => (
          <li key={n.id} className={state(n.id)}>
            <span className="mono st">{state(n.id) === 'done' ? 'done' : state(n.id)}</span>
            <strong>{n.name}</strong>
            <span className="body">
              {n.note}
              {n.needs.length
                ? ` · after ${n.needs.map((d) => roadmap.find((r) => r.id === d)!.name).join(' + ')}`
                : ''}
            </span>
          </li>
        ))}
      </ol>
      <p className="label flex gap-6 mt-6 [&_span]:flex [&_span]:items-center [&_span]:gap-2">
        <span>
          <i className="k done" />
          complete
        </span>
        <span>
          <i className="k open" />
          unlocked
        </span>
        <span>
          <i className="k locked" />
          locked
        </span>
      </p>
    </div>
  );
}
