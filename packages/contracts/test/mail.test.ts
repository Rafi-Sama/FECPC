import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkMailTemplate,
  cleanEmailHtml,
  DEFAULT_MAIL,
  htmlToText,
  MAIL_SAMPLE,
  renderMail,
} from '../src/mail.ts';

test('the built-in templates pass their own checks', () => {
  for (const k of ['recruit', 'event'] as const)
    assert.equal(checkMailTemplate(k, DEFAULT_MAIL[k]).error, undefined, k);
});

test('checkMailTemplate keeps {{link}} in recruitment mail and bounds the size', () => {
  assert.match(
    checkMailTemplate('recruit', { subject: 'Hi there', html: '<p>no link here at all</p>' })
      .error!,
    /link/,
  );
  assert.equal(
    checkMailTemplate('event', { subject: 'Hi there', html: '<p>no link here at all</p>' }).error,
    undefined,
  );
  assert.match(
    checkMailTemplate('event', { subject: 'Hi', html: '<p>long enough body</p>' }).error!,
    /subject/,
  );
  assert.match(
    checkMailTemplate('event', { subject: 'Hi there', html: 'x'.repeat(100_001) }).error!,
    /100 KB/,
  );
});

test('cleanEmailHtml strips scripts, handlers and javascript: links but keeps styling', () => {
  const out = cleanEmailHtml(
    '<style>p{color:red}</style><p onclick="x()" style="color:blue">hi</p><script>alert(1)</script><a href="javascript:alert(1)">a</a><iframe src="x"></iframe>',
  );
  assert.equal(
    out,
    '<style>p{color:red}</style><p style="color:blue">hi</p><a href="#alert(1)">a</a>',
  );
});

test('renderMail escapes values in the body and keeps the subject on one line', () => {
  const m = renderMail(
    { subject: 'Hi {{name}}', html: '<p>{{name}}</p><a href="{{link}}">Go</a>' },
    { name: 'A <b>\r\nB', link: 'https://x.test/?a=1&b=2' },
  );
  assert.equal(m.subject, 'Hi A <b> B');
  assert.equal(m.html, '<p>A &lt;b&gt;\r\nB</p><a href="https://x.test/?a=1&amp;b=2">Go</a>');
  assert.match(m.text, /Go \(https:\/\/x\.test\/\?a=1&b=2\)/);
});

test('htmlToText turns the default email into readable text with the link', () => {
  const t = htmlToText(renderMail(DEFAULT_MAIL.recruit, MAIL_SAMPLE.recruit).html);
  assert.match(t, /Welcome aboard, Nadia Rahman!/);
  assert.match(t, /Set my password \(https:\/\/example\.com\/login\?invite=sample\)/);
  assert.doesNotMatch(t, /<|style=/);
});
