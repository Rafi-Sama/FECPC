"use client";
import { useRef } from "react";
import { useTicker } from "./useTicker";
import { lcg } from "@/lib/lcg";

type Col = { y: number; v: number; len: number; on: boolean };

// Direction A: phosphor code rain on a 16px cell grid.
export default function Rain({ className, cell = 16 }: { className?: string; cell?: number }) {
  const st = useRef<{ rnd: () => number; cols: Col[]; W: number; H: number } | null>(null);
  const ref = useTicker<HTMLCanvasElement>((cv) => {
    const W = Math.ceil(cv.clientWidth / cell), H = Math.ceil(cv.clientHeight / cell);
    if (!W || !H) return;
    let s = st.current;
    const mk = (rnd: () => number, spread: boolean): Col => ({ y: spread ? rnd() * (H + 30) - 30 : -rnd() * 24, v: 0.3 + rnd() * 0.8, len: 8 + Math.floor(rnd() * 18), on: rnd() > 0.22 });
    if (!s || s.W !== W || s.H !== H) {
      const rnd = lcg(20261);
      s = st.current = { rnd, W, H, cols: Array.from({ length: W }, () => mk(rnd, true)) };
      cv.width = W; cv.height = H;
    }
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    for (let x = 0; x < W; x++) {
      let c = s.cols[x];
      c.y += c.v;
      if (c.y - c.len > H) c = s.cols[x] = mk(s.rnd, false);
      if (!c.on) continue;
      const hy = Math.floor(c.y);
      for (let d = 0; d < c.len; d++) {
        const y = hy - d;
        if (y < 0 || y >= H) continue;
        if (d === 0) g.fillStyle = "#3DFF7A";
        else if (d < 4) g.fillStyle = "#1A6B33";
        else if (d < c.len * 0.6 || (x + y) % 2 === 0) g.fillStyle = "#0C3318";
        else continue;
        g.fillRect(x, y, 1, 1);
      }
    }
  }, 90);
  return <canvas ref={ref} aria-hidden className={`px ${className ?? ""}`} style={{ width: "100%", height: "100%" }} />;
}
