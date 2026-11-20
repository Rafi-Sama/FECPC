// Small SVG charts. They take plain numbers so they work with seed or judge data alike.
export function Heatmap({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  return (
    <div
      className="heat"
      role="img"
      aria-label={`Solve heatmap, ${days.reduce((a, b) => a + b, 0)} solves in ${days.length} days`}
    >
      {days.map((v, i) => (
        <i
          key={i}
          data-l={v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4))}
          title={`${v} solved`}
        />
      ))}
    </div>
  );
}
export function Line({ pts, h = 160 }: { pts: number[]; h?: number }) {
  if (pts.length < 2) return <p className="body">Not enough rated contests yet.</p>;
  const lo = Math.min(...pts),
    hi = Math.max(...pts),
    W = 600;
  const xy = pts.map(
    (v, i) => [(i / (pts.length - 1)) * W, h - 8 - ((v - lo) / (hi - lo || 1)) * (h - 16)] as const,
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${h}`}
      className="linechart"
      role="img"
      aria-label={`Rating from ${pts[0]} to ${pts.at(-1)}, peak ${hi}`}
      preserveAspectRatio="none"
    >
      <path
        d={`M0 ${h}` + xy.map(([x, y]) => `L${x} ${y}`).join('') + `L${W} ${h}Z`}
        className="area"
      />
      <path
        d={'M' + xy.map(([x, y]) => `${x} ${y}`).join('L')}
        className="stroke"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function Radar({ data }: { data: [string, number][] }) {
  const n = data.length,
    R = 90,
    C = 130,
    max = Math.max(1, ...data.map((d) => d[1]));
  // Rounded: Node and the browser disagree in the last digit of sin/cos, which made the server and client markup differ.
  const round = (v: number) => Math.round(v * 100) / 100;
  const at = (i: number, r: number) => [
    round(C + Math.sin((i / n) * 2 * Math.PI) * r),
    round(C - Math.cos((i / n) * 2 * Math.PI) * r),
  ];
  return (
    <svg
      viewBox="0 0 260 260"
      className="radar"
      role="img"
      aria-label={'Solved by tag: ' + data.map(([k, v]) => `${k} ${v}`).join(', ')}
    >
      {[0.33, 0.66, 1].map((f) => (
        <polygon
          key={f}
          className="ring"
          points={data.map((_, i) => at(i, R * f).join(',')).join(' ')}
        />
      ))}
      <polygon
        className="shape"
        points={data.map(([, v], i) => at(i, (v / max) * R).join(',')).join(' ')}
      />
      {data.map(([k], i) => {
        const [x, y] = at(i, R + 22);
        return (
          <text key={k} x={x} y={y + 4} textAnchor="middle">
            {k}
          </text>
        );
      })}
    </svg>
  );
}
export function Bars({ data, unit = '' }: { data: number[]; unit?: string }) {
  const max = Math.max(...data);
  return (
    <div
      className="bars"
      role="img"
      aria-label={`Bar chart, ${data.length} periods, latest ${data.at(-1)}${unit}`}
    >
      {data.map((v, i) => (
        <i key={i} style={{ height: `${(v / max) * 100}%` }} title={`${v}${unit}`} />
      ))}
    </div>
  );
}
