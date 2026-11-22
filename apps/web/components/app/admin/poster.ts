import qrcode from 'qrcode-generator';

// A fixed print palette, not the viewer's theme: the poster must look the same whoever downloads it.
const BG = '#0d0d0b',
  INK = '#f2efe9',
  MUT = '#a9a59b',
  ACC = '#ffd23f';

const wrap = (ctx: CanvasRenderingContext2D, text: string, max: number) => {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  return [...lines, cur].slice(0, 2);
};

/** A 1080×1350 recruitment poster with a high-error-correction QR, ready to print or post. */
export async function poster(o: {
  url: string;
  title: string;
  batch: number;
  club: string;
  closes: string;
}): Promise<Blob> {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const W = 1080,
    H = 1350,
    c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ACC;
  ctx.fillRect(0, 0, W, 16);

  ctx.textBaseline = 'top';
  ctx.fillStyle = MUT;
  ctx.font = `600 34px ${font}`;
  ctx.fillText(o.club.toUpperCase(), 80, 84);
  ctx.fillStyle = ACC;
  ctx.font = `800 96px ${font}`;
  ctx.fillText(`Batch ${o.batch}`, 80, 140);
  ctx.fillStyle = INK;
  ctx.font = `700 52px ${font}`;
  wrap(ctx, o.title, W - 160).forEach((l, i) => ctx.fillText(l, 80, 258 + i * 62));

  // H = 30% error correction, so the code still scans when printed small or partly covered.
  const q = qrcode(0, 'H');
  q.addData(o.url);
  q.make();
  const n = q.getModuleCount(),
    box = 640,
    x0 = (W - box) / 2,
    y0 = 420,
    cell = Math.floor((box - 64) / n),
    off = Math.floor((box - cell * n) / 2); // whole pixels, so no seams between modules
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(x0, y0, box, box, 36);
  ctx.fill();
  ctx.fillStyle = BG;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (q.isDark(y, x)) ctx.fillRect(x0 + off + x * cell, y0 + off + y * cell, cell, cell);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 60px ${font}`;
  ctx.fillText('Scan to apply', W / 2, y0 + box + 48);
  ctx.fillStyle = MUT;
  ctx.font = `500 30px ${font}`;
  ctx.fillText(`Open until ${o.closes}`, W / 2, y0 + box + 128);
  ctx.font = `500 26px ui-monospace, monospace`;
  ctx.fillText(o.url.replace(/^https?:\/\//, ''), W / 2, H - 80);

  return new Promise((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error('canvas'))), 'image/png'),
  );
}
