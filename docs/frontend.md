# Frontend

`apps/web`: Next.js 16 with the App Router, React 19 and Turbopack. Next.js 16 differs from older versions.
Before using a Next API, read the bundled guide in `apps/web/node_modules/next/dist/docs/` (see
`apps/web/AGENTS.md`).

## Routes

| Group               | Folder                                               | Notes                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public site         | `app/(site)/`                                        | The `(site)` route group adds no URL segment. Shared `layout.tsx` (Nav, Footer) and `site.css`. Content comes from `@fecpc/content/site`.                                             |
| Member area         | `app/app/`                                           | Everything under `/app`. `layout.tsx` loads `AppState` on the server (`serverState()`) and redirects to `/login` without a session. Then `StoreProvider` and `Shell` wrap every page. |
| Admin and ops gates | `app/app/admin/layout.tsx`, `app/app/ops/layout.tsx` | Answer 404 unless `isAdmin` / `isCommittee`. They hide pages only; the API enforces each action.                                                                                      |
| Route handlers      | `app/api/`                                           | One-line `proxy()` calls to the API, plus the read-only `/api/cf/[handle]` and `/api/vjudge`. See [API reference](api-reference.md).                                                  |

Most member pages are client components (`'use client'`) that read the store. `contests/page.tsx` is a server
component that fetches the Codeforces contest list (`lib/cf.ts`) and passes it to `contests/client.tsx`.

## The client store

`components/app/Store.tsx` holds the member's `AppState` for the whole member area.

```tsx
const { s, me, members, office, counts, inbox, act, who, xp } = useStore();

// a change: resolves true when done; a refusal is shown as a toast automatically
const ok = await act('decide', { kind: 'payment', id: q.id, to: 'verified' });
```

- **`act(type, args)`** posts to `/api/act` and replaces the state with the server's answer. It shows a toast
  for gained XP, for a level-up, and for the server's refusal message. It shows `info` notices (such as invite
  links) in a dismissible notice. A `401` sends the browser to `/login`.
- **Out-of-order answers are dropped.** Each request gets a sequence number, and only the newest may replace
  the state.
- **Refresh when the tab is looked at again** (`visibilitychange`), to pick up other people's changes such as
  a verified payment.
- **`giveKudos(milestoneId)`** updates optimistically, with rollback, and enforces the daily cap on the client
  too.
- **`who(id)`** looks up a member in the roster, falling back to the id for people who have left.
- **`toggle(list, id)`** (exported) is a small helper to flip an id in a list.

Paged lists (feed, ideas, members, alumni, jobs, prep, blog) call `fetch('/api/community' | '/api/members' |
'/api/alumni', { action, … })` directly from their components, because they are not part of `AppState`.

## Components

```
components/
├── site/            public site: Nav, Footer, FootTheme, ApplyForm, LoginForm, Board, EventRow, Faq,
│                    ProjectGrid, Roadmap, VerifyBox
├── app/
│   ├── Shell.tsx    member-area frame and primitives: default Shell, Page (title + body), Tabs, Denied
│   ├── Store.tsx    the store (above)
│   ├── Charts.tsx   Heatmap, Line, Radar, Bars (SVG, no chart library)
│   ├── Judge.tsx    useJudge(): the member's live Codeforces data; HandleBox to link a handle
│   ├── QR.tsx       QR code (qrcode-generator)
│   ├── admin/ arena/ community/ events/ home/ sheets/   page sections used by one page each
│   ├── finance/officer.tsx   officer tabs of Finance (payments, requests, expenses, fund) and Receipt
│   ├── alumni/ feed/ ideas/ members/ announcements/  feature components and modals
│   └── shared/      MarkdownEditor (+ safe markdown rendering), RatingBadge (Codeforces tier), SolvedTier, PersonPicker (searchable people dropdown), DatePicker (calendar + clock), usePopover
└── pixel/           pixel-art sprites (Sprites.tsx), canvas effects (Life, Rain, Sphere), useTicker
```

## Styling

- Plain CSS, no framework. `app/globals.css` is the design system: tokens and primitives (`.btn`, `.panel`,
  `.tbl`, `.list`, `.pill`, `.bento`, `.stack`, `.row`, `.meter`, …). Five theme classes (`t-a` Phosphor
  Terminal, `t-b` Monolith Dither, `t-c` Insert Coin, `t-d` Signal / Life, `t-e` Blueprint) set the tokens, and
  the primitives read them. The member area uses `b` (light) and `d` (dark); Arena keeps its arcade skin.
- `app/(site)/site.css` styles the public site, and `app/app/app.css` the member area.
- Fonts come from `next/font/google`: Space Grotesk (text), JetBrains Mono (numbers, code), and VT323,
  Silkscreen and Press Start 2P (pixel display). Pixel fonts are for display only. Body text is never set
  in a pixel font below 14px.
- A member's light or dark choice is a personal flag (`act('flag', { key: 'dark', on })`), stored on the server
  so it follows them across devices.

## Conventions

- Keep the app frame (`Shell`) the same on every member page. Pages render inside `<Page title=…>`.
- Copy is short and specific. No filler paragraphs.
- Money is shown as `৳` with `toLocaleString('en-US')`. Dates use `en-GB`, as in `fmtDate`.
- Buttons that change money or accounts ask for confirmation (`confirm(...)`) and say what will happen.
- Accessibility: tabs use `role="tab"` and `aria-selected`; icon buttons have `aria-label`; modals trap
  focus.

## Create and edit forms: the save bar

Every form that creates or changes something is a `<SaveForm>` (`components/app/SaveBar.tsx`), not a
`<form>` with its own Save button.

- The form has no submit button. While it differs from its starting values, a bar at the top shows
  **Discard** and **Save** (`saveLabel`). Save calls `requestSubmit()`, so `required`, `minLength`,
  `pattern` and the rest still run in the browser before `onSubmit`.
- `onSubmit` returns `true` once saved. Anything else keeps the bar, so a refused save never loses input.
- Changes are read from the form's fields. State that has no field (chips, tree nodes, uploaded images)
  goes in `extraDirty`. Fields that only mirror a selection take `data-save-ignore`.
- Controlled forms pass `onDiscard` to restore their state; uncontrolled forms are reset.
- While the bar shows, leaving is refused with a shake (and a vibration on phones): links, `role="tab"`,
  `[data-nav]`, close buttons (`aria-label="Close…"` or `[data-close]`), modal backdrops, Escape and page
  reload. Mark any other section switcher `data-nav`.
- One-shot actions (search, sign-in, check-in codes, password change) keep their own button.
- Trim text before sending; the API validates every field again and its message is shown as is.
