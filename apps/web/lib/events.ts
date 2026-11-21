// Event reads for the member area, and certificate rendering to an image in the browser.
import { useCallback, useEffect, useState } from 'react';
import { csvCell, type PublicEvent } from '@fecpc/contracts';
import { fmtDate } from '@fecpc/content/site';

/** One read from the `events` query area; null when it failed. */
export async function eventsQuery<T>(body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

/** Loads once and on `reload()`; `data` is undefined while loading, null when it failed. */
export function useEventsQuery<T>(body: Record<string, unknown>) {
  const key = JSON.stringify(body);
  const [data, setData] = useState<T | null | undefined>(undefined);
  const reload = useCallback(async () => setData(await eventsQuery<T>(JSON.parse(key))), [key]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, reload };
}

/** Upcoming public events, for the member home. */
export function usePublicEvents() {
  const [list, setList] = useState<PublicEvent[]>([]);
  useEffect(() => {
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : []))
      .then(setList, () => {});
  }, []);
  return list;
}

/** `Sat 14 Nov · 15:00` from a club-local `YYYY-MM-DDTHH:MM`, with the year when it is not this year. */
export const fmtWhen = (t: string) =>
  `${fmtDate(t.slice(0, 10), { weekday: 'short', day: 'numeric', month: 'short', ...(t.slice(0, 4) !== String(new Date().getFullYear()) && { year: 'numeric' }) })} · ${t.slice(11, 16)}`;

/** The pixel banner, or the event's own image over it. */
export const bannerStyle = (banner: string | null): React.CSSProperties | undefined =>
  banner ? { background: `center / cover no-repeat url(${JSON.stringify(banner)})` } : undefined;

export function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const downloadCsv = (name: string, rows: unknown[][]) =>
  download(
    name,
    new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' }),
  );

// Certificates are A4 landscape at 96 dpi, drawn at 2x.
export const CERT_W = 1123,
  CERT_H = 794;

/**
 * Draws a certificate's HTML+CSS to PNG or JPEG: the page goes into an SVG foreignObject, which an <img> renders
 * (scripts never run there) and a canvas rasterises.
 * shortcut: external images and web fonts do not load inside the SVG; templates should inline them as data: URLs.
 */
export async function renderCertificate(html: string, type: 'png' | 'jpeg', name: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const xhtml = new XMLSerializer().serializeToString(doc.documentElement);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CERT_W}" height="${CERT_H}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = CERT_W * 2;
  canvas.height = CERT_H * 2;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.scale(2, 2);
  g.drawImage(img, 0, 0);
  canvas.toBlob(
    (b) => b && download(`${name}.${type === 'png' ? 'png' : 'jpg'}`, b),
    `image/${type}`,
    0.95,
  );
}

/** What sign-up looks like right now, rather than the bare status: the window can open or close it. */
export function liveStatus(e: {
  status: string;
  regOpen: boolean;
  regOpens: string | null;
  regCloses: string | null;
}): string | null {
  if (e.status !== 'open' && e.status !== 'published') return null;
  if (e.regOpen) return e.regCloses ? `Sign-up open until ${fmtWhen(e.regCloses)}` : 'Sign-up open';
  const now = clubNow();
  if (e.regOpens && e.regOpens > now) return `Sign-up opens ${fmtWhen(e.regOpens)}`;
  return e.status === 'open' ? 'Sign-up closed' : null;
}

/** Now as a club-local (Dhaka) `YYYY-MM-DDTHH:MM`, comparable with event times as text. */
export const clubNow = () =>
  new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).replace(' ', 'T').slice(0, 16);
