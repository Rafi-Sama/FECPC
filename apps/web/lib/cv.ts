// "Export CV as PDF": a one-page A4 document built from the profile, printed from a hidden frame so nothing
// from the app's own layout ends up on paper. Every value is escaped; links are only https or mailto/tel.

export type CvData = {
  name: string;
  photo: string | null;
  headline: string; // e.g. "CP Head · CSE · Batch 21"
  member: string; // e.g. "FECPC member FEC-0001 · since November 2026"
  accent: string;
  contact: { label: string; href?: string }[];
  bio: string | null;
  skills: string[];
  experience: { period: string; role: string; summary: string }[];
  stats: [string, string, string][]; // [label, value, note]
  handle: string | null;
  history: number[];
  contests: { name: string; at: string | number; rank: number; delta: number }[];
  club: string;
};

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const safeHref = (h?: string) => (h && /^(https:\/\/|mailto:|tel:)/i.test(h) ? esc(h) : '');
const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#1f3bff');
const safePhoto = (p: string | null) =>
  p && /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(p) ? esc(p) : '';

/** The rating history as a small line chart. */
function chart(pts: number[], color: string) {
  if (pts.length < 2) return '';
  const w = 300,
    h = 90,
    lo = Math.min(...pts),
    hi = Math.max(...pts),
    span = hi - lo || 1;
  const xy = pts.map(
    (p, i) =>
      `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 6 - ((p - lo) / span) * (h - 12)).toFixed(1)}`,
  );
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Rating history">
<polygon points="0,${h} ${xy.join(' ')} ${w},${h}" fill="${color}" fill-opacity=".12"/>
<polyline points="${xy.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
</svg><div class="axis"><span>${pts[0]}</span><span>now ${pts.at(-1)}</span></div>`;
}

export function cvHtml(d: CvData): string {
  const acc = safeColor(d.accent);
  const initials = d.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  const photo = safePhoto(d.photo);
  const date = (iso: string | number) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.name)} · CV</title><style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font:10.5pt/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0d0d0b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
a{color:inherit;text-decoration:none}
header{display:flex;gap:20px;align-items:center;padding-bottom:16px;border-bottom:3px solid ${acc}}
.ph{width:92px;height:92px;border-radius:50%;object-fit:cover;flex:none;border:3px solid ${acc}}
.in{width:92px;height:92px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:${acc};color:#fff;font:700 30pt/1 Helvetica,Arial,sans-serif}
h1{font-size:24pt;line-height:1.1;letter-spacing:-.02em}
.hl{margin-top:4px;font-size:11.5pt;font-weight:600;color:${acc}}
.mb{margin-top:2px;color:#5e5a50;font-size:9.5pt}
.ct{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:9.5pt}
.ct span{white-space:nowrap}
main{display:grid;grid-template-columns:1fr 210px;gap:24px;margin-top:18px}
h2{font:700 8.5pt/1 'Courier New',monospace;letter-spacing:.14em;text-transform:uppercase;color:#5e5a50;margin:0 0 8px;padding-bottom:5px;border-bottom:1px solid #d9d5cb}
section{margin-bottom:16px;break-inside:avoid}
.bio{white-space:pre-wrap}
.xp{display:grid;grid-template-columns:78px 1fr;gap:2px 12px;margin-bottom:8px}
.xp .p{color:#5e5a50;font-size:9pt;padding-top:1px}
.xp b{display:block}
.xp span{color:#33312b}
table{width:100%;border-collapse:collapse;font-size:9.5pt}
td{padding:4px 0;border-bottom:1px solid #eceae4;vertical-align:top}
td.n{text-align:right;white-space:nowrap;padding-left:10px;font-variant-numeric:tabular-nums}
td small{display:block;color:#5e5a50;font-size:8.5pt}
.up{color:#1a7f37}.dn{color:#c4321c}
.st{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.st div{border-top:3px solid ${acc};background:#f6f4ee;padding:6px 8px}
.st b{display:block;font-size:15pt;line-height:1.15}
.st span{font-size:8pt;color:#5e5a50;text-transform:uppercase;letter-spacing:.06em}
.st i{display:block;font-style:normal;font-size:8pt;color:#5e5a50}
.handle{margin-top:8px;font-size:9.5pt}
.chart{width:100%;height:auto;display:block;margin-top:4px}
.axis{display:flex;justify-content:space-between;font-size:8pt;color:#5e5a50}
.sk{display:flex;flex-wrap:wrap;gap:4px}
.sk span{border:1px solid #0d0d0b;padding:1px 7px;font-size:8.5pt}
footer{margin-top:10px;padding-top:6px;border-top:1px solid #d9d5cb;font-size:8pt;color:#8a857a;display:flex;justify-content:space-between}
</style></head><body>
<header>
${photo ? `<img class="ph" src="${photo}" alt="">` : `<div class="in">${esc(initials)}</div>`}
<div>
<h1>${esc(d.name)}</h1>
<p class="hl">${esc(d.headline)}</p>
<p class="mb">${esc(d.member)}</p>
<p class="ct">${d.contact
    .map((c) => {
      const h = safeHref(c.href);
      return `<span>${h ? `<a href="${h}">${esc(c.label)}</a>` : esc(c.label)}</span>`;
    })
    .join('')}</p>
</div>
</header>
<main>
<div>
${d.bio ? `<section><h2>About</h2><p class="bio">${esc(d.bio)}</p></section>` : ''}
${
  d.experience.length
    ? `<section><h2>Experience</h2>${d.experience
        .map(
          (x) =>
            `<div class="xp"><span class="p">${esc(x.period)}</span><div><b>${esc(x.role)}</b>${x.summary ? `<span>${esc(x.summary)}</span>` : ''}</div></div>`,
        )
        .join('')}</section>`
    : ''
}
${
  d.contests.length
    ? `<section><h2>Recent rated rounds</h2><table>${d.contests
        .slice(0, 8)
        .map(
          (c) =>
            `<tr><td>${esc(c.name)}<small>${esc(date(c.at))}</small></td><td class="n">#${esc(c.rank.toLocaleString('en'))}</td><td class="n ${c.delta >= 0 ? 'up' : 'dn'}">${c.delta >= 0 ? '+' : ''}${esc(c.delta)}</td></tr>`,
        )
        .join('')}</table></section>`
    : ''
}
</div>
<aside>
<section><h2>Competitive programming</h2>
<div class="st">${d.stats
    .map(([k, v, n]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b><i>${esc(n)}</i></div>`)
    .join('')}</div>
${d.handle ? `<p class="handle">Codeforces: <a href="https://codeforces.com/profile/${encodeURIComponent(d.handle)}"><b>${esc(d.handle)}</b></a></p>` : ''}
${chart(d.history, acc)}
</section>
${d.skills.length ? `<section><h2>Skills</h2><div class="sk">${d.skills.map((s) => `<span>${esc(s)}</span>`).join('')}</div></section>` : ''}
</aside>
</main>
<footer><span>${esc(d.club)}</span><span>Generated ${esc(date(new Date().toISOString()))}</span></footer>
</body></html>`;
}

/** Prints the CV from an invisible frame; the browser's dialog offers "Save as PDF". */
export function printCv(d: CvData) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const doc = f.contentDocument!;
  doc.open();
  doc.write(cvHtml(d));
  doc.close();
  const go = async () => {
    // The photo must be decoded before printing, or the PDF gets an empty circle.
    await Promise.all([...doc.images].map((i) => i.decode().catch(() => {})));
    f.contentWindow!.focus();
    f.contentWindow!.print();
    setTimeout(() => f.remove(), 60_000); // the dialog blocks; remove the frame well after it closes
  };
  void go();
}
