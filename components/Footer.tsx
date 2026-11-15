import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import FootTheme from "./FootTheme";
import { site } from "@/lib/site";

const cols = [
  { h: "club", links: [["/about", "about"], ["/about#team", "committee"], ["/events", "events"], ["/projects", "projects"], ["/alumni", "alumni"]] },
  { h: "compete", links: [["/contests", "contests"], ["/leaderboard", "leaderboard"], ["/leaderboard#hall", "hall of fame"], ["/blog", "editorials"]] },
  { h: "join", links: [["/join", "apply"], ["/contact", "sponsor us"], ["/contact#contact", "contact"], ["/verify", "verify a certificate"]] },
];

export const hasPhotos = () => { const d = path.join(process.cwd(), "public/gallery"); return fs.existsSync(d) && fs.readdirSync(d).some((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)); };

export default function Footer() {
  return (
    <FootTheme>
      <div className="wrap foot-grid">
        <div className="stack" style={{ "--g": "14px", gridColumn: "span 2", minWidth: 0 } as React.CSSProperties}>
          <div className="brand"><i aria-hidden />{site.short}</div>
          <p className="body" style={{ maxWidth: "44ch" }}>{site.name}. Students of {site.university} who write, ship and break real software together.</p>
          <p className="label">{site.city}</p>
        </div>
        {cols.map((c) => (
          <nav key={c.h} aria-label={c.h}>
            <p className="label" style={{ marginBottom: 10 }}>./{c.h}</p>
            {c.links.map(([href, l]) => <Link key={href} href={href}>{l}</Link>)}
            {c.h === "club" && hasPhotos() && <Link href="/gallery">gallery</Link>}
          </nav>
        ))}
        <nav aria-label="elsewhere">
          <p className="label" style={{ marginBottom: 10 }}>./elsewhere</p>
          {site.socials.map((s) => <a key={s.label} href={s.href} rel="noreferrer">{s.label}</a>)}
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </nav>
      </div>
      <div className="statusbar">
        <div><b>-- NORMAL --</b><span>main</span><span>footer.c</span></div>
        <div><span>UTF-8</span><span>LF</span><span>© {new Date().getFullYear()} {site.short}</span></div>
      </div>
    </FootTheme>
  );
}
