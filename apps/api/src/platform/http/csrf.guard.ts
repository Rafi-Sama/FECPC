import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ConfigService } from '../config/config.service.ts';
import { DomainException } from './problem-details.filter.ts';
import { ErrorCodes } from '@fecpc/contracts';

const deny = (msg: string) => new DomainException(msg, 403, ErrorCodes.FORBIDDEN_RESOURCE);
const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return 'null';
  }
};

/**
 * Cookie-authenticated writes must come from the site. The web app forwards the browser's Origin,
 * Referer and Sec-Fetch-Site, so this check sees the real page that sent the request.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) return true;

    // A custom header forces a CORS preflight, which only the allowed origins pass.
    if (req.headers['x-requested-with'] === 'fecpc') return true;

    // HTML forms cannot send JSON, so requiring it blocks the classic form-post attack.
    if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
      throw deny('Missing required security header or content type.');
    }

    if (req.headers['sec-fetch-site'] === 'cross-site') {
      throw deny('Cross-site requests are not permitted.');
    }
    const source = req.headers.origin ?? (req.headers.referer && originOf(req.headers.referer));
    if (source && !this.config.corsOrigins.includes(source)) {
      throw deny('Origin not allowed.');
    }
    return true;
  }
}
