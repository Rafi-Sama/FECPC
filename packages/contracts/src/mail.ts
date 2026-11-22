// Email templates officers design (HTML + CSS) for recruitment acceptances and event approvals. The browser
// previews with these functions and the API sends with them, so the preview is exactly what people receive.
import { fillTemplate } from './events.ts';

export type MailKind = 'recruit' | 'event';
export type MailTemplate = { subject: string; html: string };

/** The club name in emails. */
export const MAIL_CLUB = 'FECPC';
/** Gmail clips a message above 102 KB, hiding the rest behind "View entire message". */
export const MAIL_MAX_HTML = 100_000;

/** Placeholders per kind: [key, what it becomes]. `{{link}}` is required in recruitment emails. */
export const MAIL_VARS: Record<MailKind, readonly (readonly [string, string])[]> = {
  recruit: [
    ['name', "Applicant's name"],
    ['link', 'Set-password link (required)'],
    ['email', 'Sign-in email'],
    ['batch', 'Batch'],
    ['dept', 'Department'],
    ['sid', 'Student ID'],
    ['recruitment', 'Recruitment title'],
    ['club', 'Club name'],
  ],
  event: [
    ['name', "Member's name"],
    ['event', 'Event title'],
    ['date', 'Date and time'],
    ['venue', 'Venue'],
    ['role', 'Role (role applications only)'],
    ['link', 'Event page link'],
    ['club', 'Club name'],
  ],
};

export const MAIL_SAMPLE: Record<MailKind, Record<string, string>> = {
  recruit: {
    name: 'Nadia Rahman',
    link: 'https://example.com/login?invite=sample',
    email: 'nadia@example.com',
    batch: '27',
    dept: 'CSE',
    sid: '2027-331-042',
    recruitment: 'Batch 27 recruitment',
    club: MAIL_CLUB,
  },
  event: {
    name: 'Nadia Rahman',
    event: 'Intra-College Programming Contest',
    date: 'Sat 6 Dec, 10:00',
    venue: 'CSE Lab 2',
    role: '',
    link: 'https://example.com/app/events/sample',
    club: MAIL_CLUB,
  },
};

// Table layout and inline styles: what Gmail, Outlook and phone mail apps all render the same way.
const shell = (body: string) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#ece9e1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece9e1;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:2px solid #0d0d0b;">
<tr><td style="background:#0d0d0b;padding:18px 28px;font:700 14px/1 'Courier New',monospace;letter-spacing:3px;color:#ffd23f;">{{club}}</td></tr>
${body}
</table>
</td></tr>
</table>
</body></html>`;
const button = (label: string) =>
  `<tr><td style="padding:8px 28px;"><a href="{{link}}" style="display:inline-block;background:#1f3bff;color:#ffffff;text-decoration:none;font:700 16px/1 Arial,Helvetica,sans-serif;padding:16px 28px;border:2px solid #0d0d0b;">${label}</a></td></tr>`;

export const DEFAULT_MAIL: Record<MailKind, MailTemplate> = {
  recruit: {
    subject: 'Welcome to {{club}}, {{name}}: set your password',
    html: shell(`<tr><td style="padding:32px 28px 8px;font:16px/1.6 Arial,Helvetica,sans-serif;color:#0d0d0b;">
<p style="margin:0 0 8px;font:700 14px/1 'Courier New',monospace;letter-spacing:2px;color:#1f3bff;">BATCH {{batch}} · ACCEPTED</p>
<h1 style="margin:0 0 16px;font:700 28px/1.2 Arial,Helvetica,sans-serif;">Welcome aboard, {{name}}!</h1>
<p style="margin:0 0 8px;">Your application to <b>{{recruitment}}</b> was accepted. Set a password to open your member account.</p>
</td></tr>
${button('Set my password')}
<tr><td style="padding:16px 28px 28px;font:14px/1.6 Arial,Helvetica,sans-serif;color:#5e5a50;">
The link works once and expires in 7 days. Sign in with <b>{{email}}</b>, or use "Sign in with Google" with the same address.<br><br>
Button not working? Paste this into your browser:<br><a href="{{link}}" style="color:#1f3bff;word-break:break-all;">{{link}}</a>
</td></tr>
<tr><td style="border-top:1px solid #e2dfd6;padding:16px 28px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#8a857a;">You get this because you applied to join {{club}}.</td></tr>`),
  },
  event: {
    subject: "You're in: {{event}}",
    html: shell(`<tr><td style="padding:32px 28px 8px;font:16px/1.6 Arial,Helvetica,sans-serif;color:#0d0d0b;">
<p style="margin:0 0 8px;font:700 14px/1 'Courier New',monospace;letter-spacing:2px;color:#1a7f37;">✓ APPROVED</p>
<h1 style="margin:0 0 16px;font:700 28px/1.2 Arial,Helvetica,sans-serif;">See you there, {{name}}!</h1>
<p style="margin:0 0 20px;">Your place at <b>{{event}}</b> is confirmed.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2dfd6;background:#f6f4ee;">
<tr><td style="padding:14px 18px;font:14px/1.6 Arial,Helvetica,sans-serif;color:#0d0d0b;">
<b>When</b> &nbsp;{{date}}<br><b>Where</b> &nbsp;{{venue}}
</td></tr></table>
</td></tr>
${button('Open the event')}
<tr><td style="border-top:1px solid #e2dfd6;padding:16px 28px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#8a857a;">Can't make it? Cancel from the event page so someone else gets your seat.</td></tr>`),
  },
};

/**
 * Removes what has no place in an email: scripts, embedded pages and forms, event handlers and
 * `javascript:` links. Mail apps strip these too; this is a second line for the officer-side preview.
 */
export const cleanEmailHtml = (html: string) =>
  html
    .replace(/<(script|iframe|object|embed|form|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(
      /<\/?(script|iframe|object|embed|form|input|button|textarea|select|link|base|frame|frameset|meta\s+http-equiv)\b[^>]*>/gi,
      '',
    )
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /(href|src|action|formaction|background)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)\s*:/gi,
      '$1=$2#',
    );

const line = (v: unknown) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

/** Checks and cleans a template. `{{link}}` must stay in recruitment emails: without it nobody can sign in. */
export function checkMailTemplate(
  kind: MailKind,
  t: { subject?: unknown; html?: unknown },
): { value: MailTemplate; error?: string } {
  const value = {
    subject: line(t.subject),
    html: cleanEmailHtml(typeof t.html === 'string' ? t.html.trim() : ''),
  };
  if (value.subject.length < 3 || value.subject.length > 150)
    return { value, error: 'The subject must be 3 to 150 characters.' };
  if (value.html.length < 20) return { value, error: 'The email body is empty.' };
  if (value.html.length > MAIL_MAX_HTML)
    return {
      value,
      error: 'The email is over 100 KB; Gmail would cut it off. Shorten it or link images.',
    };
  if (kind === 'recruit' && !/\{\{\s*link\s*\}\}/.test(value.html))
    return {
      value,
      error: 'Keep {{link}} in the email: it is how new members set their password.',
    };
  return { value };
}

/** The plain-text part sent alongside the HTML; mail apps that hide HTML, and spam filters, read it. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|head|title)\b[\s\S]*?<\/\1>/gi, '')
    .replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, t: string) => {
        const label = t.replace(/<[^>]+>/g, '').trim();
        return label && label !== href ? `${label} (${href})` : href;
      },
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The finished email: placeholders filled (HTML-escaped in the body; no line breaks in the subject). */
export function renderMail(t: MailTemplate, vars: Record<string, string>) {
  const html = fillTemplate(t.html, vars);
  return {
    subject: t.subject
      .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k: string) => vars[k] ?? '')
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 200),
    html,
    text: htmlToText(html),
  };
}
