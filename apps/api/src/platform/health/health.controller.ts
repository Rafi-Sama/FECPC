import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DbService } from '../database/db.service.ts';
import { Public } from '../../modules/auth/decorators.ts';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch {
      reply.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'down', timestamp: new Date().toISOString() };
    }
  }
}
