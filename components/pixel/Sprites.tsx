import { lcg } from "@/lib/lcg";

const bmp = (rows: string[]) => rows.flatMap((r, y) => [...r].map((c, x) => (c === "X" ? `M${x} ${y}h1v1h-1z` : ""))).join("");
export const BUG_A = bmp(["...X...X...", "....XXX....", "..XXXXXXX..", "XXX.XXX.XXX", "..XXXXXXX..", "XXXXX.XXXXX", "..XXXXXXX..", ".X..X.X..X."]);
export const BUG_B = bmp(["X.........X", ".X.XXXXX.X.", "..XXXXXXX..", ".XX.XXX.XX.", "XXXXXXXXXXX", "..XXX.XXX..", ".X.XXXXX.X.", "X..X...X..X"]);
const HEART = "M1 0h2v1h-2zM4 0h2v1h-2zM0 1h7v2h-7zM1 3h5v1h-5zM2 4h3v1h-3zM3 5h1v1h-1z";
const SHIP = "M2 0h7v1h-7zM2 1h1v2h-1zM8 1h1v2h-1zM2 3h7v1h-7zM0 4h11v1h-11z";
const TROPHY = bmp(["XXXXXXXXX", "X.XXXXX.X", "X.XXXXX.X", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X....", "...XXX...", "..XXXXX.."]);
const COLORS = ["#3DE1FF", "#FF4D8D", "#FFD23F"];

export const Bug = ({ i = 0, size = 66, color }: { i?: number; size?: number; color?: string }) => (
  <svg aria-hidden viewBox="0 0 11 8" width={size} height={(size * 8) / 11} className="px"><path d={i % 2 ? BUG_B : BUG_A} fill={color ?? COLORS[i % 3]} /></svg>
);
export const Heart = ({ size = 28, off }: { size?: number; off?: boolean }) => (
  <svg aria-hidden viewBox="0 0 7 6" width={size} height={(size * 6) / 7} className="px"><path d={HEART} fill={off ? "#3A1D6E" : "#FF4D8D"} /></svg>
);
export const Ship = ({ size = 66 }: { size?: number }) => (
  <svg aria-hidden viewBox="0 0 11 5" width={size} height={(size * 5) / 11} className="px"><path d={SHIP} fill="#3DE1FF" /></svg>
);
export const Trophy = ({ size = 36, color = "#FFD23F" }: { size?: number; color?: string }) => (
  <svg aria-hidden viewBox="0 0 9 9" width={size} height={size} className="px"><path d={TROPHY} fill={color} /></svg>
);

// Direction C backdrop: two twinkling star layers + a pixel ridge along the bottom.
export function Starfield({ seed = 4242, ground = true }: { seed?: number; ground?: boolean }) {
  const rnd = lcg(seed);
  let a = "", b = "", gr = "", ri = "", h = 7;
  for (let k = 0; k < 80; k++) {
    const c = `M${Math.floor(rnd() * 180)} ${Math.floor(rnd() * 94)}h1v1h-1z`;
    if (k % 2) a += c; else b += c;
  }
  for (let x = 0; x < 180; x += 3) {
    h = Math.min(9, Math.max(4, h + Math.floor(rnd() * 5) - 2));
    gr += `M${x} ${16 - h}h3v${h}h-3z`; ri += `M${x} ${16 - h}h3v1h-3z`;
  }
  return (
    <div aria-hidden className="bgfx stars">
      <svg viewBox="0 0 180 112" preserveAspectRatio="xMidYMid slice" className="px tw1"><path d={a} fill="#fff" /></svg>
      <svg viewBox="0 0 180 112" preserveAspectRatio="xMidYMid slice" className="px tw2"><path d={b} fill="#8E84C9" /></svg>
      {ground && <svg viewBox="0 0 180 16" preserveAspectRatio="none" className="px ridge"><path d={gr} fill="#1D1145" /><path d={ri} fill="#4A2A8F" /></svg>}
    </div>
  );
}

// 5×5 mirrored identicon, so every member has a face without a photo.
export function Avatar({ name, size = 40, fg = "var(--acc)", bg = "var(--panel)" }: { name: string; size?: number; fg?: string; bg?: string }) {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  let d = "";
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if ((h >> (y * 3 + x)) & 1) d += `M${x + 1} ${y + 1}h1v1h-1z${x < 2 ? `M${5 - x} ${y + 1}h1v1h-1z` : ""}`;
  return <svg aria-hidden viewBox="0 0 7 7" width={size} height={size} className="px avatar" style={{ background: bg }}><path d={d} fill={fg} /></svg>;
}
