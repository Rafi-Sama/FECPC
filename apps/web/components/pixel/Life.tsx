'use client';
import { useRef } from 'react';
import { useTicker } from './useTicker';
import { lcg } from '@/lib/lcg';

type S = {
  W: number;
  H: number;
  cur: Uint8Array;
  prev: Uint8Array;
  gen: number;
  rnd: () => number;
};

// Direction D: Conway's Game of Life on a wrapped grid. Click or drag to seed cells.
// Writes generation and population into [data-life=gen|count|grid] in the same section.
export default function Life({ className, cell = 10 }: { className?: string; cell?: number }) {
  const st = useRef<S | null>(null);
  const step = (s: S) => {
    const { W, H, cur: a, prev: b } = s;
    for (let y = 0; y < H; y++) {
      const yu = ((y + H - 1) % H) * W,
        yd = ((y + 1) % H) * W,
        yy = y * W;
      for (let x = 0; x < W; x++) {
        const xl = (x + W - 1) % W,
          xr = (x + 1) % W;
        const n =
          a[yu + xl] +
          a[yu + x] +
          a[yu + xr] +
          a[yy + xl] +
          a[yy + xr] +
          a[yd + xl] +
          a[yd + x] +
          a[yd + xr];
        b[yy + x] = n === 3 || (n === 2 && a[yy + x]) ? 1 : 0;
      }
    }
    s.prev = a;
    s.cur = b;
    s.gen++;
    if (s.gen % 90 === 0)
      splash(s, Math.floor(s.rnd() * (W - 14)), Math.floor(s.rnd() * (H - 14)), 14);
  };
  const splash = (s: S, px: number, py: number, n: number) => {
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = px + i,
          y = py + j;
        if (x >= 0 && y >= 0 && x < s.W && y < s.H && s.rnd() < 0.4) s.cur[y * s.W + x] = 1;
      }
  };
  const ref = useTicker<HTMLCanvasElement>((cv) => {
    const W = Math.ceil(cv.clientWidth / cell),
      H = Math.ceil(cv.clientHeight / cell);
    if (!W || !H) return;
    let s = st.current;
    if (!s || s.W !== W || s.H !== H) {
      const rnd = lcg(1970);
      s = st.current = {
        W,
        H,
        rnd,
        gen: 0,
        cur: new Uint8Array(W * H),
        prev: new Uint8Array(W * H),
      };
      for (let i = 0; i < s.cur.length; i++) s.cur[i] = rnd() < 0.3 ? 1 : 0;
      for (let k = 0; k < 12; k++) step(s);
      cv.width = W * 10;
      cv.height = H * 10;
    } else step(s);
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, cv.width, cv.height);
    let count = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x,
          a = s.cur[i],
          p = s.prev[i];
        if (!a && !p) continue;
        if (a) count++;
        g.fillStyle = a ? (p ? '#FF5A1F' : '#FFC2A3') : '#4A1F0E';
        g.fillRect(x * 10 + 1, y * 10 + 1, 8, 8);
      }
    const sec = cv.closest('section');
    const put = (k: string, v: string) => {
      const el = sec?.querySelector(`[data-life=${k}]`);
      if (el) el.textContent = v;
    };
    put('gen', String(s.gen).padStart(6, '0'));
    put('count', String(count));
    put('grid', `${W} × ${H}`);
  }, 140);
  const seed = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (!s || (e.type === 'pointermove' && !e.buttons)) return;
    const r = e.currentTarget.getBoundingClientRect();
    splash(
      s,
      Math.floor((e.clientX - r.left) / cell) - 3,
      Math.floor((e.clientY - r.top) / cell) - 3,
      7,
    );
  };
  return (
    <canvas
      ref={ref}
      onPointerDown={seed}
      onPointerMove={seed}
      role="img"
      aria-label="Conway's Game of Life running live on a pixel grid"
      className={`px ${className ?? ''}`}
      style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'pan-y' }}
    />
  );
}
