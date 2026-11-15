"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { nav, site } from "@/lib/site";

// The bar takes the theme of whatever section sits under it, so it changes
// costume as the landing page scrolls through the four directions.
export default function Nav() {
  const path = usePathname();
  const [t, setT] = useState("a");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    const read = () => {
      const el = document.elementFromPoint(innerWidth / 2, 66)?.closest("[data-t]");
      if (el) setT(el.getAttribute("data-t")!);
    };
    read();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", esc);
    addEventListener("scroll", read, { passive: true });
    return () => { removeEventListener("scroll", read); removeEventListener("keydown", esc); };
  }, [path]);
  return (
    <header className={`nav t-${t}`} data-open={open}>
      <div className="wrap">
        <Link href="/" className="brand"><i aria-hidden />{site.short}</Link>
        <nav id="nav-links" className="nav-links" aria-label="Main">
          {nav.map((n) => <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>{n.label}</Link>)}
          <Link href="/login" className="nav-m in">Sign in</Link>
          <Link href="/join" className="nav-m jn">Join</Link>
        </nav>
        <div className="nav-right">
          <Link href="/login" className="nav-in">Sign in</Link>
          <Link href="/join" className="btn sm nav-cta">
            Join
          </Link>
          <button className="burger" aria-label="Menu" aria-expanded={open} aria-controls="nav-links" onClick={() => setOpen(!open)}><i /><i /><i /></button>
        </div>
      </div>
    </header>
  );
}
