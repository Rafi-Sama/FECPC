import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DomainException } from '../../platform/http/problem-details.filter.ts';
import { ErrorCodes, type Role } from '@fecpc/contracts';
import type { RequestUser } from '../auth/decorators.ts';

const STAFF_ROLES: ReadonlySet<Role> = new Set(['cp_head', 'president', 'super_admin']);

export function isLearningStaff(role: Role | undefined): boolean {
  return !!role && STAFF_ROLES.has(role);
}

export function requireLearningStaff(user: RequestUser | undefined): RequestUser {
  if (!user) {
    throw new DomainException(
      'Authentication required.',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHENTICATED,
    );
  }
  if (!isLearningStaff(user.role)) {
    throw new DomainException(
      'Only CP Head or President can perform this action.',
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN_RESOURCE,
    );
  }
  return user;
}

@Injectable()
export class LearningStaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest & { user?: RequestUser }>();
    requireLearningStaff(req.user);
    return true;
  }
}
