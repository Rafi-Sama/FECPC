import qrcode from 'qrcode-generator';

/** A real, scannable QR code as a crisp SVG. */
export default function QR({
  text,
  size = 96,
  fg = '#0D0D0B',
  bg = '#fff',
}: {
  text: string;
  size?: number;
  fg?: string;
  bg?: string;
}) {
  const q = qrcode(0, 'M');
  // UTF-8 bytes as a byte string: the library's default keeps only the low byte of each character (breaks ৳).
  q.addData(String.fromCharCode(...new TextEncoder().encode(text)), 'Byte');
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
  // Whole pixels per module, or crispEdges rounds modules to uneven widths and scanners fail.
  const px = Math.max(1, Math.floor(size / (n + 4))) * (n + 4);
  return (
    <svg
      role="img"
      aria-label={`QR code: ${text}`}
      viewBox={`0 0 ${n + 4} ${n + 4}`}
      width={px}
      height={px}
      className="px flex-none"
      style={{ background: bg }}
    >
      <path d={d} fill={fg} />
    </svg>
  );
}
