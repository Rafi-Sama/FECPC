# Tailwind migration

Running log of the move from hand-written CSS to Tailwind CSS v4 in `apps/web`. The rule for every step:
**the UI must render exactly as before**. Every phase is checked against a baseline taken before the switch.

## Starting point (2026-11-26)

| What                                             | Size                           |
| ------------------------------------------------ | ------------------------------ |
| `app/globals.css` (tokens, 5 themes, primitives) | 1,269 lines                    |
| `app/(site)/site.css`                            | 1,411 lines                    |
| `app/app/app.css`                                | 15,245 lines, 151 `!important` |
| `app/app/alumni-cards.css`                       | 2,025 lines                    |
| `components/app/learning/learning.css`           | 400 lines                      |
| Inline `style={{…}}` in TSX                      | 1,254                          |
| TSX files / pages                                | 140 / 37                       |

## Strategy

1. **Infrastructure, zero visual change.** Install `tailwindcss` + `@tailwindcss/postcss`. Map the existing tokens
   (`--bg`, `--ink`, `--acc`, … and the font variables) into `@theme inline`, so utilities such as `text-dim`,
   `bg-panel` and `font-label` follow the active theme class (`t-a` … `t-e`) exactly as the legacy CSS does.
2. **Legacy CSS goes into `@layer components`.** Unlayered CSS beats every layer, so if the old files stayed
   unlayered no utility could override them. Each legacy file is imported with `layer(components)` from a small
   wrapper, so the files themselves are not reindented. Order between them is unchanged.
3. **No Preflight.** `globals.css` already has its own reset. Tailwind's Preflight would change heading, button,
   image and border defaults, so only `theme` and `utilities` are imported.
4. **Inline styles → utilities.** Static `style={{…}}` objects become classes. Values that depend on runtime data
   (`width: pct + '%'`, colours from data) stay inline, or become a CSS variable plus a utility.
5. **Legacy rules → utilities or shared components, feature by feature.** A rule used by one component moves into
   that component's `className`. A pattern used in many places stays a named class (`.btn`, `.panel`, …) in
   `@layer components`, which is Tailwind's own advice for reuse, or becomes a React component. Rules that match
   nothing are deleted.

## Rules for converting (gotchas)

- `text-sm`, `text-lg`, … also set `line-height`. To copy a bare `font-size: 13px`, use `text-[13px]`.
- `max-[860px]:` compiles to `@media (width < 860px)`, but legacy `max-width: 860px` means `≤ 860`. Use
  `max-[861px]:` for the same breakpoint. `min-[861px]:` matches `min-width: 861px`.
- Legacy `!important` inside `@layer components` still beats any normal utility, as it beat inline styles
  before. Don't fight it with `!` utilities; remove the `!important` when its rule is migrated.
- Spacing scale is 4px: `mt-2` = 8px, `mt-1.5` = 6px. Odd pixel values use arbitrary values (`mt-[13px]`).
- Theme colours: `text-dim`, `bg-panel`, `border-line`, … (see `@theme` in `globals.css`). Raw hex stays arbitrary
  (`text-[#c4321c]`) only if the legacy code used raw hex.
- Before adding a legacy class name, check it does not collide with a Tailwind utility (`grid`, `hidden`, `row`, …).
- Theme-scoped rules: legacy `.t-b .x { … }` → `t-b:…` (custom variants `t-a` … `t-e` in `globals.css`, descendants
  only, like the old selectors). `.t-b.x` (the themed element itself) → `[&.t-b]:…`.
- Utilities always beat legacy CSS, whatever its specificity. When a rule moves out of CSS, every other legacy rule
  that matched the same element and property must be accounted for: if a legacy rule used to win, its value moves
  too, or the element changes.
- Between two utilities the order is Tailwind's, not the class string's: variants sort after plain utilities, and
  variants sort among themselves by registration. Check `hover:` against `t-b:` and breakpoint variants when both
  set the same property on one element.
- Descendant and state selectors: `.card:hover .x` → `group` on the card + `group-hover:` on `.x`; `.list > li` →
  `*:` or `[&>li]:` on the parent; `::before`/`::after` → `before:`/`after:` with `content-['']`.

## Target end state

Most CSS lives as utilities in the TSX. The CSS files keep only what utilities can't express or shouldn't repeat:

- `_styles/tailwind.css`: theme tokens and custom variants, shared by the two utility entries
  (`(site)/site.utilities.css` for the public site, `app/app/app.layer.css` for the member area).
- `_styles/base.css`: reset, the five theme token sets, `@keyframes`, and the design-system primitives used all over
  (`.btn`, `.panel`, `.tbl`, `.pill`, `.input`, …). A primitive reused in many places stays one named class, so a
  change is one edit.
- Rules that utilities can't express cleanly: rendered Markdown bodies, generated `content`, complex `:has()` or
  sibling chains, print styles.

Everything feature-specific (`site.css`, `app.css`, `alumni-cards.css`, `learning.css`) moves into its component.

## Verification

A Playwright harness (kept out of the repo) visits every public page and every member page (as the seeded admin),
on desktop 1440×900 in light and dark and on mobile 390×844, and clicks through each page's tabs. For each capture it
stores a full-page screenshot (canvases masked) and the computed style of every element and pseudo-element
(about 110 properties). A phase passes only when screenshots and computed styles match the baseline, beyond the
noise measured by running the baseline twice.

## Tooling (outside the repo)

- Reference server: a git worktree of the pre-migration commit (`2c23e9c`) running `next dev -p 3100` with its own
  in-process API on the same database. Any page or modal can be compared live against it, beyond the stored baseline.
- `capture.mjs` also forces `:hover`/`:active` and then `:focus`/`:focus-visible`/`:focus-within` on every element
  (CDP `CSS.forcePseudoState`) and stores the computed styles, so hover and focus rules are verified too. Signed-in
  runs take a lock, because they share the admin account's server-side dark flag.
- `rules.mjs <class…>` prints every legacy rule that mentions a class, in cascade order with its `@media` context.
  `rmrule.mjs <file> '<key>'…` deletes rules by context + selector, re-reading the file first, so two agents can
  edit one CSS file safely.
- `prune.mjs` removes selectors whose classes appear nowhere in `app`, `components` or `lib`, and exact duplicate
  rules (the later copy is the one that applied).

## Log

- **Phase 0 (baseline).** 237 captures (12 public pages, 23 member pages, their tabs; desktop light/dark, mobile),
  taken twice before any change. Noise between the two runs: only Next's `next-route-announcer` position and one
  avatar photo that sometimes finishes loading after the shot. Both are ignored by the comparison.
- **Phase 1 (infrastructure).** `tailwindcss` and `@tailwindcss/postcss` 4.3.5, `postcss.config.mjs`.
  `app/globals.css` is now the Tailwind entry: layer order, theme and utilities (no Preflight), `@source` limited
  to `app`, `components` and `lib`, and the token mapping. The old design system moved unchanged to
  `app/_styles/base.css`. `site.css`, `app.css`, `alumni-cards.css` and `learning.css` are loaded through
  `*.layer.css` wrappers that import them into `@layer components`.
  - Collisions found by compiling before any migration: `.sticky` (legacy: only at ≥900px), `.ring` (SVG stroke)
    and `.btn.outline`. Tailwind would also style these, so they are blocked with `@source not inline(…)`.
    `.grid` and `.grow` also collide but set the same property, so they are left alone.
  - `app.css` set `--sans: var(--font-sans, 'Space Grotesk', …)`. Tailwind defines `--font-sans`, which made a
    variable cycle. `--font-sans` was never defined before, so the line now holds its old fallback as a literal.
  - Result: all 237 captures identical to the baseline (screenshots and computed styles).
- **Phase 2A (inline styles, `app/**` and most components).** 613 `style` props → 122. The ~1,100 static style keys
  became utilities (a TypeScript-AST codemod, applied file by file and verified with the harness). The 122 left
  depend on data (colours, sizes, progress), or are tied to a dynamic sibling key, or sit on components that don't
  forward `className`.
- **Phase 2B (inline styles, `components/app/alumni`, `components/app/events`).** 641 → 96 `style` props. Of the 96
  left, about 59 depend on data and about 37 set CSS variables (`--i`, `--p`, …) that legacy animations read. Repeated
  strings went to module consts, plus `components/app/events/ui.ts`. Verified with a HEAD-vs-working-tree comparison
  across three accounts and 24 views, modals included, because the admin account never reaches career or prep.
  - Trap found: turning inline `display: grid` into `grid` also matched the legacy `.grid` primitive, which adds a
    24px gap and auto-fit columns. `.grow` is the same kind of trap (`min-width: 0`). Use `[display:grid]` and
    `[flex-grow:1]` until those primitives are renamed. Two Phase 2A cases (admin menu popover, sheets curate form)
    were fixed the same way.
- **Dead and duplicate CSS pruned.** Selectors whose classes appear nowhere in `app`, `components` or `lib` were
  removed, and so were exact duplicate rules (the later copy was the one that applied; `app.css` had whole sections
  pasted twice). `app.css` 15,245 → 13,692 lines; about 1,600 lines in all.
  - Caught by the harness: the first pass treated `.p1`–`.p3` as dead, but `Board.tsx` builds them as
    `` `p${i + 1}` ``. Any `` `prefix${…}` `` in the source now protects every class starting with that prefix.
- **Phase 3A (legacy rules → utilities: public site, shell, finance, members, admin, profile, contests, audit log).**
  A translator (`tw.mjs`, outside the repo) reads every legacy rule that mentions a class. It turns each selector into
  a variant on the element that carries the class (`hover:`, `max-[861px]:`, `t-b:`, `[.parent_&]:`, `[&_li]:`), and
  each declaration into a named utility where that is exactly equivalent, or else an arbitrary property. It edits the
  `className` through the TypeScript AST: inline when the class is used once or its utilities are short, otherwise one
  module const per file. It then deletes the selectors from the CSS. 75 classes moved (about 46 public-site, 29
  member-area). `site.css` 1,407 → 889 lines. In `app.css`, 13,692 → 12,407 lines, also counting agent B's
  concurrent work.
  - `globals.css` now redefines `hover` as plain `&:hover`. Tailwind 4's default wraps it in `@media (hover: hover)`,
    which would change touch devices.
  - A class is refused (and stays in CSS) when: it is not present in any captured DOM, so the harness can't verify
    it (modals, menus, dialogs, the apply form); it is used in several files (a shared pattern: it stays a named
    class); it is also used by agent B's files; it is referenced as a selector by other utilities or by JS; its
    name may be built at runtime (`` `p${i}` ``); it has `!important`; one variant mixes a shorthand with its
    longhands; or the result would be long or mostly styles for children (`[&_.child]:` chains read worse than the
    CSS).
  - Cascade check: utilities beat every legacy rule, so before a move the translator looks for other legacy rules
    that could match the same element (or the same descendant) and used to win on specificity or order. Their
    classes are a subset of the element's static classes, and their tag matches the JSX tag. Any hit refuses the
    move. Three regressions found by the harness led to this check: `.input.sm { width: auto }` beat `.al-search`,
    `.side .brand` beat `.side-top .brand` on phones, and `.finance-table td` beat `.finance-mono`. All three were
    reverted or fixed.
  - Other traps found: a type selector must stay first in an arbitrary variant (`[.x_small&]`, not `[.x_&small]`).
    Per-side non-solid borders have no utility (`border-dashed` styles all four sides, and without Preflight the
    other sides then get the default `medium` width), so they stay arbitrary (`[border-bottom:1px_dashed_…]`). After
    a burst of writes to an `@import`ed legacy file, the dev server sometimes kept serving the old CSS; editing the
    `*.layer.css` wrapper forces a recompile.
  - Left in CSS on purpose: shared patterns used across pages (`sec`, `wrap`, `lede`, `pillars`, `statusbar`, …),
    descendant-heavy blocks (`shell`, `kanban`, `idcard`, the finance balance and tools, audit-log areas and days),
    and everything the harness cannot open. Those need an interactive check (open the modal on :3100 and :3000 and
    compare) before they move.
  - Verified: full light run (public and member pages, desktop and mobile, forced `:hover` and `:focus`) matches the
    reference except known noise (route announcer, countdown text, avatar load race, gallery dev badge, a relative
    time in a community feed card). Dark theme not run for this phase.
- **Phase 3B (legacy rules → utilities: all feature CSS).** The translator was rebuilt with stronger static checks and
  run in three batches over `app.css`, `alumni-cards.css`, `site.css` and `learning.css` (about 490 classes moved,
  plus about 100 dead selectors pruned). `app.css` 11,767 → 7,258 lines, `alumni-cards.css` 1,987 → 1,179,
  `site.css` 889 → 445, `learning.css` 402 → 139 (after the clean-up below: `app.css` 7,583, `alumni-cards.css` 1,278).
  - Each selector is anchored on the element that carries its class. Contexts become variants: themes become `t-b:`,
    an ancestor that the JSX nesting already guarantees is dropped, anything else becomes an exact arbitrary
    variant (`[.ev-detail_&]:`, `[&_button+button]:`). A rule is skipped for an element where its context can never
    match.
  - Ancestry is a render graph: imports, JSX nesting, `children` and JSX props passed into wrappers, layouts, and the
    call sites of a component (for `.x > div` on a component's root element). Class combinations come from the
    `className` expression (`a ? 'x' : 'y'` never yields both), including module consts.
  - Stylesheet scope matters: `app.css` and `alumni-cards.css` load only under `app/app`, `site.css` under `(site)`
    and `app/app`, `learning.css` only on courses and quiz. A rule that is loaded on only some pages rendering an
    element is not moved.
  - Order is checked against Tailwind's real output (compiled, not guessed): when Tailwind would order two utilities
    differently from the legacy cascade, the legacy winner gets a specificity bump (`[&&]:`), up to three times.
  - Traps found and fixed: the `list-item` class name is a Tailwind utility (`display: list-item`), so it is now in
    `@source not inline`. A utility glued to `${…}` in a template literal (`h-[36px]${on ? ' on' : ''}`) is not seen
    by Tailwind's scanner; five such cases from earlier phases now have a space. `[all:unset]` conflicts with every
    property. A shorthand (`inset`, `padding`) is only dead when existing utilities cover all its longhands. A class
    that a variant elsewhere still names (`[.hero-d_&]`, `[.list-meta_&]`) must stay on its element as a marker.
  - Verified with the harness rebuilt from scratch, against the reference server, for five accounts (public, admin,
    president, treasurer, member), desktop with forced `:hover`/`:focus`, mobile and dark. Every view matches except
    known noise: SMTP status (the reference has no mail server), event banner URL host, a font-load race on one
    Codeforces error card, and the alumni tab loading race.
  - Left in CSS: shared primitives used in more than three files, classes reached only through component props or
    module consts the tool can't edit, and rules whose move would change the cascade (mostly `.t-b`/`.t-d`
    overrides on shared primitives, `.list > div`-style child rules, and the reduced-motion `!important` reset).
- **Phase 3C (clean-up for maintainability).**
  - Elements whose utilities had become mostly styles for children (15+ `[&_x]:` variants: the rendered Markdown
    body `.cm-md`, the account menu `.me-menu`, the date-picker clock, the dossier journey and activity lists, the
    recruit "more" box, the alumni mini card, the segmented control `.seg`, the person picker list) went back to
    named classes. Their rules were restored at their original cascade positions.
  - Repeated className strings (54 strings, 145 uses) became named constants: in the file when used there only,
    otherwise in a `ui.ts` next to the feature (`components/site/ui.ts`, `components/app/{admin,alumni,shared}/ui.ts`,
    and the existing ones). No long className string is repeated now.
  - 34 legacy declarations that a later rule with the same selector always overrode were deleted, and two
    adjacent rules with identical bodies were merged.
  - Trap found: `` `x${on ? ' y' : ''}` `` was read as a class prefix `x…`, which hid `.x.y` rules from the cascade
    check and emptied six modifier classes (`.is-empty`, `.is-here`, `.is-sel`, `.is-single`, `.picked`, `.shake`).
    All six are back, and the translator now treats a span whose values all start with a space as a separate class.
  - The harness now also opens dialogs and menus (`CLICK` locators by role/text, identical on both servers): profile
    and alumni modals, post, new post, idea and announcement modals, pay and receipt modals, job detail, date
    picker, command palette and account menu. All match the reference.
- **Phase 4 (load only what a page uses).** A Lighthouse re-run showed the migration had slowed the public pages
  (FCP 0.9 s → 1.2–1.5 s): one utilities sheet for the whole app (37 KB gzip) loaded on every public page.
  - Utilities are now built per section. `(site)/site.utilities.css` scans only what the public pages render;
    `app/app/app.layer.css` scans everything else and is complete on its own for the member area. `globals.css` keeps
    only the layer order and `base.css`. Tailwind emits only the theme variables a sheet's utilities use, so both
    entries import `_styles/tailwind.css` (not `@reference`).
  - CSS per page (gzip): public 38.5 KB → 15.6 KB; member 60.2 KB → 57.3 KB.
  - Dialogs that render nothing until opened load their code on demand (`next/dynamic`): Community's post, new
    post, announcement, idea, new idea, join and interested dialogs, the profile modal (Community, directory), and
    Career's alumni profile, job detail and post job dialogs. Their option lists moved to `feed/ui.ts` and
    `ideas/ui.ts` so the pages don't import the dialog modules for them.
  - Checked against the previous production build: every public and member page in desktop, mobile and dark, and
    each lazy dialog opened in all three. Only the event banner URL's host differs.
  - Not CSS, found by the same re-audit: `@fecpc/contracts` is now `"sideEffects": false`, so member pages no longer
    ship Zod (36 KB gzip). See finding 25 in [Performance audit](performance-audit.md).
