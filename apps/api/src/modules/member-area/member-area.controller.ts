import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { waitUntil } from '@vercel/functions';
import { act, auditQuery, avatar, exportMembers, profileRequestPhoto } from './actions.ts';
import { applicantPhoto, apply, recruitPublic } from './recruit.ts';
import { Fail, pool } from './db.ts';
import * as queries from './queries.ts';
import { eventBanner, eventsQuery, publicEvents, verifyCertificate } from './events.ts';
import { syncCodeforces, syncVjudge } from './milestones.ts';
import { ensureWeekly } from './sheets.ts';
import { sameSecret } from './tokens.ts';
import { forgetShared, loadState, rosterJson } from './state.ts';
import { drainMail } from './mail.ts';
import { CurrentUser, type RequestUser } from '../auth/decorators.ts';
import { Public } from '../auth/decorators.ts';

// AuthGuard (global) has proved who the user is. Every handler below checks what that user may do.
const AREAS = {
  alumni: queries.alumni,
  community: queries.community,
  members: queries.members,
  events: eventsQuery,
  audit: auditQuery,
};

const object = (b: unknown): Record<string, unknown> => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Fail(400, 'Send a JSON object.');
  return b as Record<string, unknown>;
};

@Controller()
export class MemberAreaController {
  /** Everything the signed-in member may see, in one payload (AppState). */
  @Get('me/state')
  async state(@CurrentUser() user: RequestUser) {
    return { state: await loadState(pool(), user.id) };
  }

  /**
   * The roster the member may see. Sent apart from the state because it grows with the club; the ETag lets the
   * browser revalidate it after every change for the cost of a 304.
   */
  @Get('me/roster')
  async roster(
    @CurrentUser() user: RequestUser,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const r = (await rosterJson(pool(), user.id)) ?? { body: '{"members":[]}', tag: '"none"' };
    res.header('etag', r.tag).header('cache-control', 'private, no-cache');
    if (req.headers['if-none-match'] === r.tag) return void res.status(304);
    res.header('content-type', 'application/json; charset=utf-8');
    return r.body;
  }

  /** One change `{ type, ...args }`; answers with the member's fresh state and an optional notice. */
  @Post('me/actions')
  @HttpCode(200)
  async act(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const info = await act(user.id, object(body)); // act() clears the shared cache
    // After the commit, mail queued by this action goes out; on Vercel the function stays alive until it is sent.
    waitUntil(drainMail().catch(() => {}));
    return { state: await loadState(pool(), user.id), info: info ?? null };
  }

  /** Paged reads and writes for the feed, ideas, members and alumni pages: `{ action, ...args }`. */
  @Post('queries/:area')
  @HttpCode(200)
  async query(
    @CurrentUser() user: RequestUser,
    @Param('area') area: string,
    @Body() body: unknown,
  ) {
    if (!Object.hasOwn(AREAS, area)) throw new Fail(404, 'Not found.');
    return AREAS[area as keyof typeof AREAS](pool(), user.id, object(body));
  }

  /** Refreshes the member's own Codeforces and VJudge stats and milestones, at most once a minute. */
  @Post('me/codeforces/sync')
  @HttpCode(200)
  async syncCodeforces(@CurrentUser() user: RequestUser) {
    // Once a minute per member, in the database so every API instance shares it.
    const go = await pool().query(
      `update users set judge_synced_at = now() where id = $1
         and (judge_synced_at is null or judge_synced_at < now() - interval '1 minute')`,
      [user.id],
    );
    if (!go.rowCount) return { synced: false };
    const [cf, vj] = await Promise.all([
      syncCodeforces(pool(), user.id),
      syncVjudge(pool(), user.id),
    ]);
    if (cf || vj) forgetShared();
    return { synced: !!(cf || vj), milestonesCreated: cf?.milestonesCreated ?? 0 };
  }

  /**
   * The periodic work a long-running server does on timers: this week's sheet and the mail queue. Vercel Cron
   * calls it daily with `Authorization: Bearer CRON_SECRET`; a free pinger may call it every few minutes.
   */
  @Public()
  @Get('cron')
  async cron(@Req() req: FastifyRequest) {
    const s = process.env.CRON_SECRET;
    if (!s || !sameSecret(req.headers.authorization, `Bearer ${s}`))
      throw new Fail(404, 'Not found.');
    await ensureWeekly(pool());
    await drainMail();
    return { ok: true };
  }

  /** A recruitment link's public form: title, batch, closing time and the optional questions. */
  @Public()
  @Get('recruit/:token')
  async recruit(@Param('token') token: string) {
    const r = await recruitPublic(pool(), token);
    if (!r) throw new Fail(404, 'This recruitment link does not exist.');
    return r;
  }

  /** An applicant's photo, for officers who review applications. Never cached by shared caches. */
  @Get('applications/:id/photo')
  async photo(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const p = await applicantPhoto(pool(), user.id, id);
    res.header('content-type', p.type).header('cache-control', 'private, max-age=86400');
    return p.body;
  }

  /** A member's photo. The link carries a version (`?v=`), so the browser may keep it for good. */
  @Get('avatars/:id')
  async avatar(@Param('id') id: string, @Res({ passthrough: true }) res: FastifyReply) {
    const p = await avatar(pool(), id);
    res
      .header('content-type', p.type)
      .header('cache-control', 'private, max-age=31536000, immutable');
    return p.body;
  }

  /** The new photo in a profile change request, for the officers who review it. */
  @Get('profile-requests/:id/photo')
  async requestPhoto(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const p = await profileRequestPhoto(pool(), user.id, id);
    res.header('content-type', p.type).header('cache-control', 'private, no-store');
    return p.body;
  }

  /** The form behind a recruitment link. Anyone may call it, so `apply` validates every field strictly. */
  @Public()
  @Post('applications')
  @HttpCode(200)
  async apply(@Body() body: unknown, @Req() req: FastifyRequest) {
    await apply(pool(), object(body), req.ip);
    return { ok: true };
  }

  /** Upcoming events for the public site. */
  @Public()
  @Get('events')
  async events() {
    return publicEvents(pool());
  }

  /** An event's banner image, linked from event lists. Versioned by `?v=`, so it may be cached for good. */
  @Public()
  @Get('events/:id/banner')
  async banner(
    @Param('id') id: string,
    @Query('v') v: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const p = await eventBanner(pool(), id, String(v ?? ''));
    res
      .header('content-type', p.type)
      .header('cache-control', 'public, max-age=31536000, immutable');
    return p.body;
  }

  /** One certificate by code, for the public verify page. Codes are 40 random bits, so they cannot be guessed. */
  @Public()
  @Get('certificates/:code')
  async certificate(@Param('code') code: string) {
    const c = await verifyCertificate(pool(), code);
    if (!c) throw new Fail(404, 'No certificate has that code.');
    return c;
  }

  /** Member list as CSV for roles with data.export. The download itself is audited. */
  @Get('exports/members')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="fecpc-members.csv"')
  @Header('Cache-Control', 'no-store')
  async exportMembers(@CurrentUser() user: RequestUser) {
    return exportMembers(user.id);
  }
}
