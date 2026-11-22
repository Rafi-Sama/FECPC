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

export default function Roadmap({
  done = [] as string[],
  onPick,
}: {
  done?: string[];
  /** Makes unlocked nodes open their material. */
  onPick?: (id: string) => void;
}) {
  const state = (id: string) => {
    const n = roadmap.find((r) => r.id === id)!;
    return done.includes(id) ? 'done' : n.needs.every((d) => done.includes(d)) ? 'open' : 'locked';
  };
  const pick = (id: string) =>
    onPick && state(id) !== 'locked'
      ? {
          role: 'button',
          tabIndex: 0,
          style: { cursor: 'pointer' },
          onClick: () => onPick(id),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPick(id);
            }
          },
        }
      : {};
  return (
    <div className="roadmap">
      <svg viewBox="0 0 1000 300" aria-hidden={!onPick} className="rm-svg">
        {roadmap.flatMap((n) =>
          n.needs.map((d) => {
            const [x1, y1] = pos[d],
              [x2, y2] = pos[n.id],
              mx = x2 - 9;
            return (
              <path
                key={d + n.id}
                className={`edge ${done.includes(d) ? 'lit' : ''}`}
                d={`M${x1 + W} ${y1 + H / 2}H${mx}V${y2 + H / 2}H${x2}`}
              />
            );
          }),
        )}
        {roadmap.map((n) => {
          const [x, y] = pos[n.id];
          return (
            <g
              key={n.id}
              className={`node ${state(n.id)}`}
              transform={`translate(${x} ${y})`}
              aria-label={onPick ? `${n.name}, ${state(n.id)}` : undefined}
              {...pick(n.id)}
            >
              <rect width={W} height={H} />
              <text x={12} y={28} className="t1">
                {n.name}
              </text>
              <text x={12} y={50} className="t2">
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
      <ol className="rm-list">
        {roadmap.map((n) => (
          <li key={n.id} className={state(n.id)} {...pick(n.id)}>
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
      <p className="label rm-key">
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
