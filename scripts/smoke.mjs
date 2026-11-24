// node scripts/smoke.mjs <base-url> — checks a running production build end to end (CI runs it against `next start`
// with the API in-process, and against the live site after a deploy). With SMOKE_EMAIL and SMOKE_PASSWORD it also
// signs in and saves; with CRON_SECRET it runs the cron. Exits 1 on any failure.
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const { SMOKE_EMAIL, SMOKE_PASSWORD, CRON_SECRET } = process.env;
const json = { 'content-type': 'application/json', origin: base };
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failed++;
};
const get = (path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' });

const home = await get('/');
check('home page renders', home.status === 200, home.status);
for (const h of ['content-security-policy', 'x-frame-options', 'x-content-type-options'])
  check(`header ${h}`, !!home.headers.get(h));
check('login page renders', (await get('/login')).status === 200);
check('state needs a session', (await get('/api/state')).status === 401);
check('judge proxy needs a session', (await get('/api/cf/tourist')).status === 401);

const bad = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: json,
  body: '{"email":1}',
});
check('malformed sign-in is a 400', bad.status === 400, bad.status);

if (SMOKE_EMAIL && SMOKE_PASSWORD) {
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
  });
  const setCookie = login.headers.getSetCookie();
  check('sign-in works', login.status === 200, login.status);
  check(
    'session cookie is httpOnly',
    setCookie.some((c) => /httponly/i.test(c)),
  );
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');

  const state = await get('/api/state', { cookie });
  const body = state.ok ? await state.json() : null;
  check('state loads', state.status === 200 && !!body?.state?.me, state.status);
  check('member page renders', (await get('/app', { cookie })).status === 200);
  const act = await fetch(base + '/api/act', {
    method: 'POST',
    headers: { ...json, cookie },
    body: '{"type":"readAll"}',
  });
  check('an action saves', act.status === 200, act.status);
  const csrf = await fetch(base + '/api/act', {
    method: 'POST',
    headers: { ...json, cookie, origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    body: '{"type":"readAll"}',
  });
  check('cross-site write is refused', csrf.status === 403, csrf.status);
}
check('cron needs its secret', (await get('/api/cron')).status === 404);
if (CRON_SECRET)
  check(
    'cron runs with its secret',
    (await get('/api/cron', { authorization: `Bearer ${CRON_SECRET}` })).status === 200,
  );

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
