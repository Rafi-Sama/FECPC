import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Role, UserStatus } from '@fecpc/contracts';

/** The signed-in user, as AuthGuard loaded it from the database for this request. */
export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  handle: string;
  squad: string;
}

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route (or controller) as reachable without a session. Everything else requires one. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Injects the RequestUser that AuthGuard attached to the request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as RequestUser | undefined;
});
