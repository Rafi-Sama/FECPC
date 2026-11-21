import { Body, Controller, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { act, apply, exportMembers } from './actions.ts';
import { Fail, pool } from './db.ts';
import * as queries from './queries.ts';
import { eventsQuery, publicEvents, verifyCertificate } from './events.ts';
import { syncCodeforces, syncVjudge } from './milestones.ts';
import { loadState } from './state.ts';
import { CurrentUser, type RequestUser } from '../auth/decorators.ts';
import { Public } from '../auth/decorators.ts';

// AuthGuard (global) has proved who the user is. Every handler below checks what that user may do.
const AREAS = {
  alumni: queries.alumni,
  community: queries.community,
  members: queries.members,
  events: eventsQuery,
};

// shortcut: per-process throttle, reset on restart and not shared between instances; move it to the DB if the API scales out.
const lastCodeforcesSync = new Map<string, number>();

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

  /** One change `{ type, ...args }`; answers with the member's fresh state and an optional notice. */
  @Post('me/actions')
  @HttpCode(200)
  async act(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const info = await act(user.id, object(body));
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
    const now = Date.now();
    if (now - (lastCodeforcesSync.get(user.id) ?? 0) < 60_000) return { synced: false };
    lastCodeforcesSync.set(user.id, now);
    const [cf, vj] = await Promise.all([
      syncCodeforces(pool(), user.id),
      syncVjudge(pool(), user.id),
    ]);
    return { synced: !!(cf || vj), milestonesCreated: cf?.milestonesCreated ?? 0 };
  }

  /** The public join form. Anyone may call it, so `apply` validates every field strictly. */
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
