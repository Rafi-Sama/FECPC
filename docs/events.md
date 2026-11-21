# Events

Events live in the database. The President and Secretary (`event.publish`) create and run them; members
register, apply for roles, leave feedback and download certificates from `/app/events/[id]`. Code:
`apps/api/src/modules/member-area/events.ts` (handlers and reads), `packages/contracts/src/events.ts` (shapes,
`fillTemplate`, `parseCsv`), `apps/web/components/app/events/` and `apps/web/app/app/events/`.

## Lifecycle

`draft` → `published` → `open` (registration open) → `closed` → `ongoing` → `completed`, or `cancelled`. The
organiser sets the status; nothing moves on its own, except that `completed` is final (certificates depend on
it). An event with issued certificates cannot be deleted; cancel it instead. Drafts are visible to organisers only. Platform
registration is accepted while the status is `open` and the time is inside the optional opening/closing
window. Role applications are accepted while the event is `published`, `open` or `closed`.

## Registration

Each event, and each of its roles (Volunteer, Teaching Assistant…), picks one method:

- **Google Forms**: the page shows the link and a QR code. Nothing is stored or counted here.
- **Platform**: Name and Phone are always asked, plus the organiser's questions (`fields`: label, required,
  options for a choice). Answers go to `event_entries` (`role_id` null for participants). Approval is
  `auto` (approved at once) or `manual` (pending). Statuses: pending, approved, rejected, cancelled
  (the member withdrew; they may register again). Seats count pending and approved participants, under a
  row lock on the event; organisers approving or reopening entries are held to the same limit.

## Check-in

Each event has its own room code (`club_events.checkin`), shown to organisers on the event page while it is
`open`, `closed` or `ongoing`. An approved participant types it in (`attend`) and the event id is added to
their attendance (+XP).

`s.reg` in `AppState` is the member's approved participant event ids (XP, event invoices).

## Responses, feedback

Organisers see every entry on the event page (Organise → Responses): stats per participant/role, search,
filters, bulk approve/decline, answers, 1st–3rd place for approved participants, CSV export of the filtered
rows (built in the browser). Feedback (rating 1–5 and text) opens when the event is `completed`, once per
member who has an approved entry; only organisers read it.

## Certificates

1. Mark the event `completed`.
2. Save a raw HTML+CSS template per kind: `participant`, `winner1`–`winner3`, `role:<id>`. Placeholders are
   `{{name}}`, `{{email}}`, `{{batch}}`, `{{dept}}`, `{{phone}}`, `{{event}}`, `{{date}}`, `{{role}}`,
   `{{place}}`, `{{code}}`, or any mapped CSV column. Values are HTML-escaped. The preview is a sandboxed iframe.
3. Generate: from registrations (every approved entry gets the template of its kind: placed participants get
   their winner template) or from a CSV for one kind (columns mapped to placeholders, one must be `email`).
   Each issued certificate is stored in `event_certificates` (email lower-cased) with its filled HTML and a
   code that stays the same when regenerated. From registrations, `{{name}}` is the account name, not the
   name typed at sign-up, and re-running removes certificates an entrant no longer earns (declined,
   un-placed). CSV certificates for people without an entry are left alone.
4. Turn distribution on. Members whose account email matches see their certificates in place of the
   Participate card and download PNG or JPG, drawn in the browser (SVG `foreignObject` → canvas). External
   images and fonts do not load there; inline them as `data:` URLs.

## Public site

`GET /v1/certificates/:code` (public) backs `/verify`: event, kind, name and date of an issued certificate.

`GET /v1/events` (public) lists published, open, closed and ongoing events that started less than a day ago, for `/`, `/events`, `/gallery` and
the member home.
