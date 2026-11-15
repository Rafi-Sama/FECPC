"use client";
import { useRef } from "react";
import { useTicker } from "./useTicker";

const bayer = (() => {
  let m = [[0]];
  for (let k = 0; k < 3; k++) {
    const n = m.length, next: number[][] = [];
    for (let y = 0; y < n * 2; y++) {
      next.push([]);
      for (let x = 0; x < n * 2; x++) next[y].push(4 * m[y % n][x % n] + (y < n ? (x < n ? 0 : 2) : x < n ? 3 : 1));
    }
    m = next;
  }
  return m;
})();

// Direction B: a sphere in 1-bit ordered dither, lit by an orbiting light.
// Writes the light angle into the nearest [data-theta] element.
export default function Sphere({ className, ink = "#0D0D0B", paper = "#ECE9E1" }: { className?: string; ink?: string; paper?: string }) {
  const t = useRef(0.9);
  const ref = useTicker<HTMLCanvasElement>((cv) => {
    const N = 128, R = 60, C = 64;
    if (cv.width !== N) { cv.width = N; cv.height = N; }
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, N, N);
    g.fillStyle = paper; g.beginPath(); g.arc(C, C, R, 0, 7); g.fill();
    g.fillStyle = ink;
    let lx = Math.cos(t.current) * 0.78, ly = -0.42, lz = Math.sin(t.current) * 0.78 + 0.25;
    const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const nx = (x + 0.5 - C) / R, ny = (y + 0.5 - C) / R, rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const li = Math.max(0, nx * lx + ny * ly + Math.sqrt(1 - rr) * lz);
      let dark = 1 - (0.05 + 0.95 * li);
      if (rr > 0.93) dark = Math.max(dark, 0.55);
      if (dark > (bayer[y % 8][x % 8] + 0.5) / 64) g.fillRect(x, y, 1, 1);
    }
    const out = cv.closest("section")?.querySelector("[data-theta]");
    if (out) out.textContent = String(Math.round((t.current * 180 / Math.PI) % 360)).padStart(3, "0") + "°";
    t.current += 0.05;
  }, 110);
  return <canvas ref={ref} role="img" aria-label="A sphere drawn in one-bit ordered dither, lit by a slowly orbiting light" className={`px ${className ?? ""}`} />;
}
