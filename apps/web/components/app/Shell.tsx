'use client';
import { SaveBarProvider } from './SaveBar';
import { PromptProvider } from './shared/PromptDialog';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MemberFace } from './shared/MemberFace';
import { owes } from '@fecpc/content/member-area';
import { can, canFully, isAdmin, isCommittee, roleName, LEVEL, level } from '@fecpc/contracts';
import type { AppState } from '@fecpc/contracts';
import { site } from '@/lib/site';
import { useStore } from './Store';

const navBadge =
  "[font:700_14px_var(--mono),monospace] [background:var(--acc)] text-on min-w-[20px] h-[20px] [display:grid] [place-items:center] p-[0_5px] min-[861px]:[[data-rail='true']_.side_nav_&]:absolute min-[861px]:[[data-rail='true']_.side_nav_&]:top-0.5 min-[861px]:[[data-rail='true']_.side_nav_&]:right-0.5 min-[861px]:[[data-rail='true']_.side_nav_&]:min-w-[18px] min-[861px]:[[data-rail='true']_.side_nav_&]:h-[18px] [.topbar_.rail-btn_&]:absolute [.topbar_.rail-btn_&]:top-0 [.topbar_.rail-btn_&]:-right-0.5 [.topbar_.rail-btn_&]:min-w-[18px] [.topbar_.rail-btn_&]:h-[18px] [animation:badge-in_0.35s_cubic-bezier(0.3,1.6,0.6,1)]";

type Item = readonly [href: string, label: string];
const groups: { g: string; items: Item[] }[] = [
  { g: 'Home', items: [['/app', 'Today']] },
  {
    g: 'Run',
    items: [
      ['/app/ops', 'Workspace'],
      ['/app/admin', 'Admin'],
    ],
  },
  {
    g: 'Train',
    items: [
      ['/app/sheets', 'Sheets'],
      ['/app/contests', 'Contests'],
      ['/app/learn', 'Learn'],
      ['/app/teams', 'ICPC teams'],
    ],
  },
  { g: 'Play', items: [['/app/arena', 'Arena']] },
  {
    g: 'Club',
    items: [
      ['/app/events', 'Events'],
      ['/app/community', 'Community'],
      ['/app/directory', 'Members'],
      ['/app/career', 'Alumni & jobs'],
      ['/app/wiki', 'Wiki'],
      ['/app/finance', 'Finance'],
    ],
  },
];
// Pages folded under one sidebar link; they show as a link row on that link's pages.
const subs: Record<string, { self: string; items: Item[] }> = {
  '/app/learn': {
    self: 'Roadmap',
    items: [
      ['/app/courses', 'Courses'],
      ['/app/quiz', 'Quiz'],
      ['/app/prep', 'Interview prep'],
    ],
  },
  '/app/contests': { self: 'Contests', items: [['/app/contest-day', 'Contest day']] },
};
const mine: Item[] = [
  ['/app/notifications', 'Inbox'],
  ['/app/profile', 'Profile'],
]; // live in the top bar; on phones, in the More sheet
const all = [
  ...groups.flatMap((g) => g.items),
  ...Object.values(subs).flatMap((x) => x.items),
  ...mine,
].map(([href, label]) => ({ href, label }));

// Hand-drawn 24px line icons, one per module (no icon dependency for ~20 glyphs).
const icons: Record<string, string> = {
  '/app': 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  '/app/notifications': 'M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0',
  '/app/sheets': 'M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M12 6h8M12 12h8M12 18h8',
  '/app/contests':
    'M8 4h8v5a4 4 0 01-8 0V4zM8 6H4v1a3 3 0 004 3M16 6h4v1a3 3 0 01-4 3M12 13v4M8 20h8',
  '/app/learn': 'M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14',
  '/app/teams':
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18 14.5a6.5 6.5 0 013.5 5.5',
  '/app/arena':
    'M7 8h10a5 5 0 015 5v1a3 3 0 01-5.5 1.7L15.5 14h-7l-1 1.7A3 3 0 012 14v-1a5 5 0 015-5zM7 10v3M5.5 11.5h3M16 10.5h.01M18 12h.01',
  '/app/events': 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  '/app/community': 'M4 5h16v11H9l-5 4V5z',
  '/app/directory':
    'M3 5h18v14H3zM8.5 12a2 2 0 100-4 2 2 0 000 4zM5.5 16a3 3 0 016 0M14 9h4M14 13h4',
  '/app/career': 'M3 8h18v11H3zM9 8V5h6v3M3 13h18',
  '/app/wiki': 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  '/app/ops': 'M4 4h16v16H4zM8 8v8M12 8v4M16 8v6',
  '/app/admin': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  '/app/profile': 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  '/app/finance': 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H3V7zM3 7V5h14v2M16 13.5h2',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  rail: 'M3 4h18v16H3zM9 4v16',
  out: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
};
const Icon = ({ k }: { k: string }) => (
  <svg
    className="flex-none [.side_nav_a_&]:text-mut [.side_nav_a_&]:[transition:transform_0.2s_ease,color_0.18s_ease] [.side_nav_a:hover_&]:[color:var(--hue)] [.side_nav_a:hover_&]:[transform:translateX(2px)_scale(1.08)] [.side_nav_a[aria-current='page']_&]:[color:var(--hue)] [.me-menu_&]:text-mut"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={icons[k]} />
  </svg>
);

function Palette({ th, pages }: { th: string; pages: typeof all }) {
  const { members } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  const router = useRouter();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQ('');
        ref.current?.showModal();
      }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);
  const hits = [
    ...pages.map((i) => ({ k: i.href, label: i.label, sub: 'Go to', href: i.href })),
    ...members.map((m) => ({
      k: m.id,
      label: m.name,
      sub: `@${m.handle} · member`,
      href: `/app/directory?q=${encodeURIComponent(m.name)}`,
    })),
  ]
    .filter((h) => (h.label + h.sub).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);
  const go = (href: string) => {
    ref.current?.close();
    router.push(href);
  };
  return (
    <>
      <button
        className="search"
        aria-label="Search"
        title="Search (Ctrl K)"
        onClick={() => {
          setQ('');
          ref.current?.showModal();
        }}
      >
        <Icon k="search" />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={ref}
        className={`palette t-${th}`}
        onClick={(e) => e.target === ref.current && ref.current.close()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (hits[0]) go(hits[0].href);
          }}
        >
          <input
            className="input"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a page or a member"
            aria-label="Search"
          />
        </form>
        <ul>
          {hits.map((h) => (
            <li key={h.k}>
              <button onClick={() => go(h.href)}>
                <span>{h.label}</span>
                <span className="label">{h.sub}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="body p-3.5">Nothing matches “{q}”.</li>}
        </ul>
      </dialog>
    </>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const { s, me, xp, act, inbox, office } = useStore();
  const normPath =
    path === '/app/members' || path.startsWith('/app/members/') ? '/app/directory' : path;
  const cur =
    [...all].reverse().find((i) => normPath === i.href || normPath.startsWith(i.href + '/')) ??
    all[0];
  const top =
    Object.keys(subs).find((k) => subs[k].items.some((i) => i[0] === cur.href)) ?? cur.href;
  const fam = subs[top] && [[top, subs[top].self] as const, ...subs[top].items];
  const lv = level(xp),
    streak = s.run;
  // Officer screens are not listed for roles that cannot open them (the server refuses those routes as well).
  // An operator account is not a member: it gets the officer screens, the directory and its own account, nothing personal.
  const show = (href: string) =>
    href === '/app/ops'
      ? isCommittee(s.roles)
      : href === '/app/admin'
        ? isAdmin(s.roles)
        : !me.system ||
          [
            '/app/directory',
            '/app/finance',
            '/app/profile',
            '/app/notifications',
            '/app/community',
            '/app/events',
            ...(can(s.roles, 'contest.run') ? ['/app/contests', '/app/contest-day'] : []),
            ...(canFully(s.roles, 'teams.oversee') ? ['/app/teams'] : []),
          ].includes(href);
  const router = useRouter();
  useEffect(() => {
    if (me.system && !show(cur.href)) router.replace('/app/admin');
  });
  const signOut = () =>
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).finally(() => {
      location.href = '/';
    });
  const badge: Record<string, number> = {
    '/app/notifications': inbox.filter((n) => !s.read.includes(n.id)).length,
    '/app/finance':
      (me.system ? 0 : s.dues.filter((i) => owes(s.pay, i.id)).length) +
      (canFully(s.roles, 'payments.verify')
        ? (office.queue ?? []).filter((q) => q.status === 'pending' && !q.mine).length
        : 0),
    '/app/admin': Object.values(s.apps).filter((x) => x === 'pending').length,
  };
  useEffect(() => {
    document.title = `${cur.label} — ${site.short}`;
  }, [cur.label]);
  // Topbar menus are <details>: close them on a click outside or Escape.
  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      document.querySelectorAll<HTMLDetailsElement>('.topbar details[open]').forEach((d) => {
        if (e instanceof KeyboardEvent || !d.contains(e.target as Node)) d.open = false;
      });
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  const rail = !!s.flags.rail,
    dark = !!s.flags.dark;
  const th = dark ? 'd' : 'b'; // light = the paper skin, dark = the charcoal one; Arena keeps its arcade skin, the sidebar stays dark
  const link = ([href, label]: Item) => (
    <Link
      key={href}
      href={href}
      title={rail ? label : undefined}
      aria-current={href === top ? 'page' : undefined}
    >
      <Icon k={href} />
      <span className="t">{label}</span>
      {badge[href] > 0 && <b className={navBadge}>{badge[href]}</b>}
    </Link>
  );
  return (
    <div className="shell" data-more={more} data-rail={rail}>
      <aside className="side t-d">
        <div className="side-top flex items-center gap-[4px] min-[861px]:[[data-rail='true']_&]:flex-col max-[861px]:contents">
          <div className="brand">
            <i aria-hidden />
            <span className="t">{site.short}</span>
          </div>
          <button
            className="rail-btn"
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!rail}
            onClick={() => act('flag', { key: 'rail', on: !rail })}
          >
            <Icon k="rail" />
          </button>
          <button
            className="rail-btn max-[861px]:[&.rail-btn]:[display:grid] hidden! max-[861px]:[display:grid]!"
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Light theme' : 'Dark theme'}
            onClick={() => act('flag', { key: 'dark', on: !dark })}
          >
            <Icon k={dark ? 'sun' : 'moon'} />
          </button>
        </div>
        {!me.system && (
          <>
            <Link
              href="/app/arena"
              className="xphud"
              aria-label={`Level ${lv.lv}, ${LEVEL - lv.into} XP to next level, ${streak} day streak${s.checkin ? '' : ', at risk today'}`}
            >
              <div className="xphud-top">
                <span className="xphud-lv">LV {lv.lv}</span>
                <span className={`xphud-st ${s.checkin ? '' : 'risk'}`}>
                  <b aria-hidden>♥</b> {streak}d
                </span>
              </div>
              <div
                className="meter"
                style={{ '--v': `${(lv.into / LEVEL) * 100}%` } as React.CSSProperties}
              >
                <i />
              </div>
              <span className="xphud-sub">
                {LEVEL - lv.into} XP to LV {lv.lv + 1}
                {s.checkin ? '' : ' · streak at risk'}
              </span>
            </Link>
          </>
        )}
        <nav aria-label="Modules">
          {groups
            .map((g) => ({ ...g, items: g.items.filter((i) => show(i[0])) }))
            .filter((g) => g.items.length)
            .map((g) => (
              <div key={g.g} className="nav-g" data-g={g.g}>
                <p className="label">{g.g}</p>
                {g.items.map(link)}
              </div>
            ))}
          <div className="nav-g me">
            <p className="label">Me</p>
            {mine.map(link)}
            <button className="out" onClick={signOut}>
              Sign out
            </button>
          </div>
        </nav>
      </aside>
      <div className="body">
        <header className="topbar [position:sticky] top-0 z-15 [display:grid] grid-cols-[1fr_minmax(0,420px)_1fr] items-center gap-4 min-h-[60px] p-[0_clamp(16px,3vw,40px)] [border-bottom:1px_solid_var(--line)] [&_.search]:w-full max-[861px]:hidden print:hidden t-d">
          <span />
          <Palette th={th} pages={all.filter((i) => show(i.href))} />
          <div className="flex items-center gap-1.5 [justify-self:end]">
            <button
              className="rail-btn"
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={dark ? 'Light theme' : 'Dark theme'}
              onClick={() => act('flag', { key: 'dark', on: !dark })}
            >
              <Icon k={dark ? 'sun' : 'moon'} />
            </button>
            <details
              className="[&_summary]:[list-style:none] [&_summary]:cursor-pointer [&_summary::-webkit-details-marker]:hidden [&[open]_summary]:text-acc relative"
              key={'n' + path}
            >
              <summary
                className="rail-btn"
                aria-label={`Inbox, ${badge['/app/notifications']} unread`}
                title="Inbox"
              >
                <Icon k="/app/notifications" />
                {badge['/app/notifications'] > 0 && (
                  <b className={navBadge}>{badge['/app/notifications']}</b>
                )}
              </summary>
              <div className="notif-menu">
                {inbox.length === 0 ? (
                  <p className="body">Nothing yet.</p>
                ) : (
                  // Unread first; otherwise in the order the server lists them.
                  [...inbox]
                    .sort((a, b) => +s.read.includes(a.id) - +s.read.includes(b.id))
                    .slice(0, 6)
                    .map((n) => (
                      <div key={n.id} data-read={s.read.includes(n.id) || undefined}>
                        <span className="label">{n.cat}</span>
                        <Link href={n.href}>{n.text}</Link>
                        <InboxActions n={n} />
                      </div>
                    ))
                )}
                <div className="notif-foot">
                  <Link href="/app/notifications">See all</Link>
                  {badge['/app/notifications'] > 0 && (
                    <button onClick={() => act('readAll')}>Mark all read</button>
                  )}
                </div>
              </div>
            </details>
            <details className="me" key={path}>
              <summary>
                <MemberFace url={me.avatar_url} name={me.name} size={28} />
                <span>
                  <strong>{me.name}</strong>
                  <span className="label">{me.role || roleName[s.role]}</span>
                </span>
              </summary>
              <div className="me-menu">
                {mine.slice(1).map(([href, label]) => (
                  <Link key={href} href={href} aria-current={href === top ? 'page' : undefined}>
                    <Icon k={href} />
                    <span className="t">{label}</span>
                    {badge[href] > 0 && <b className={navBadge}>{badge[href]}</b>}
                  </Link>
                ))}
                <button onClick={signOut}>
                  <Icon k="out" />
                  <span className="t">Sign out</span>
                </button>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className={`main t-${cur.href === '/app/arena' ? 'c' : th}`}>
          {fam && (
            <nav className="subnav" aria-label="Section">
              {fam.map(([href, label]) => (
                <Link key={href} href={href} aria-current={href === cur.href ? 'page' : undefined}>
                  {label}
                </Link>
              ))}
            </nav>
          )}
          <SaveBarProvider>
            <PromptProvider>{children}</PromptProvider>
          </SaveBarProvider>
        </main>
      </div>
      <nav className="tabbar t-d" aria-label="Quick navigation">
        {[
          ['/app', 'Today', 'Home'],
          ['/app/sheets', 'Train', 'Train'],
          ['/app/arena', 'Arena', 'Play'],
          ['/app/events', 'Club', 'Club'],
        ].map(([href, l, g]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              !more && groups.find((x) => x.g === g)!.items.some((i) => i[0] === top)
                ? 'page'
                : undefined
            }
          >
            {l}
          </Link>
        ))}
        <button aria-expanded={more} onClick={() => setMore(!more)}>
          More
        </button>
      </nav>
    </div>
  );
}

export function Page({
  title,
  children,
  aside,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="page">
      <header className="head row between max-w-none flex-row items-end">
        <h1 className="h2">{title}</h1>
        {aside}
      </header>
      {children}
    </div>
  );
}
export function Denied({ need }: { need: string }) {
  return (
    <div className="panel">
      <p className="label bad">Permission denied</p>
      <h2 className="h3 my-2">Your role cannot open this.</h2>
      <p className="body">Needs: {need}.</p>
    </div>
  );
}
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="row tabs [--g:8px]" role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === value}
          className={`tag tab ${t === value ? 'on' : ''}`}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/** One-click answers on a notification; the action's handler re-checks permission. */
export function InboxActions({ n }: { n: AppState['inbox'][number] }) {
  const { act } = useStore();
  const [busy, setBusy] = useState(false);
  if (!n.actions?.length) return null;
  return (
    <span className="row [--g:8px]">
      {n.actions.map((x) => (
        <button
          key={x.label}
          className="btn xs line"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await act(x.type, x.args); // once answered, the server leaves it out of the inbox
            setBusy(false);
          }}
        >
          {x.label}
        </button>
      ))}
    </span>
  );
}
