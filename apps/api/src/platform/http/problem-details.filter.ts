import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCodes, type ErrorCode, type ProblemDetails } from '@fecpc/contracts';

export class DomainException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    public readonly code: ErrorCode,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message, status);
  }
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // The request id is echoed back, so a client-supplied one must look like an id (logging uses the same rule).
    const requestId = String(request.id ?? 'unknown-request-id');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred.';
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      code = exception.code;
      title = exception.message;
      detail = exception.message;
      errors = exception.errors;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.VALIDATION_FAILED;
      title = 'Validation Failed';
      detail = 'The request payload or parameters failed validation.';
      errors = {};
      for (const issue of exception.issues) {
        const path = issue.path.join('.') || 'body';
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
    } else if (exception instanceof HttpException || httpStatusOf(exception)) {
      // Nest's HttpException, or a Fastify error (bad JSON, body too large, rate limit) carrying `statusCode`.
      status =
        exception instanceof HttpException ? exception.getStatus() : httpStatusOf(exception)!;
      const res = exception instanceof HttpException ? exception.getResponse() : exception;
      detail =
        status >= 500
          ? 'An unexpected error occurred.'
          : typeof res === 'string'
            ? res
            : (res as { message?: string }).message || 'The request could not be handled.';
      title = 'Request Failed';
      code = ErrorCodes.BAD_REQUEST;

      if (status === HttpStatus.UNAUTHORIZED) {
        code = ErrorCodes.UNAUTHENTICATED;
        title = 'Unauthenticated';
      } else if (status === HttpStatus.FORBIDDEN) {
        code = ErrorCodes.FORBIDDEN_CAPABILITY;
        title = 'Forbidden';
      } else if (status === HttpStatus.NOT_FOUND) {
        code = ErrorCodes.RESOURCE_NOT_FOUND;
        title = 'Not Found';
      } else if (status === HttpStatus.CONFLICT) {
        code = ErrorCodes.STATE_CONFLICT;
        title = 'State Conflict';
      } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = ErrorCodes.RATE_LIMITED;
        title = 'Rate Limited';
      } else if (status === HttpStatus.BAD_REQUEST) {
        code = ErrorCodes.BAD_REQUEST;
        title = 'Bad Request';
      } else if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        title = 'Payload Too Large';
      } else if (status >= 500) {
        code = ErrorCodes.INTERNAL_ERROR;
        title = 'Internal Server Error';
      }
    } else if (typeof exception === 'object' && exception !== null && 'code' in exception) {
      // Postgres error codes
      const pgCode = (exception as any).code;
      if (pgCode === '23505') {
        // Unique violation
        status = HttpStatus.CONFLICT;
        code = ErrorCodes.STATE_CONFLICT;
        title = 'Conflict';
        detail = 'A resource with these unique attributes already exists.';
      } else if (pgCode === '23503') {
        // Foreign key violation
        status = HttpStatus.CONFLICT;
        code = ErrorCodes.STATE_CONFLICT;
        title = 'Reference Conflict';
        detail = 'The referenced entity does not exist or cannot be removed.';
      } else if (pgCode === '23514') {
        // Check constraint violation
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        code = ErrorCodes.BAD_REQUEST;
        title = 'Constraint Violation';
        detail = 'The submitted data violates a business rule constraint.';
      } else if (typeof pgCode === 'string' && pgCode.startsWith('22')) {
        // Data exception: a value the client sent that the column cannot hold (out-of-range number, NUL byte, bad date)
        status = HttpStatus.BAD_REQUEST;
        code = ErrorCodes.BAD_REQUEST;
        title = 'Bad Request';
        detail = 'A value in the request is out of range or malformed.';
      } else if (['40001', '40P01', '55P03', '57014'].includes(pgCode)) {
        // Serialization, deadlock, lock timeout or statement timeout
        status = HttpStatus.SERVICE_UNAVAILABLE;
        code = ErrorCodes.SERVICE_UNAVAILABLE;
        title = 'Concurrency Conflict';
        detail = 'Database concurrency conflict. Please retry.';
      }
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(`[ProblemDetailsFilter] Internal server error [${requestId}]:`, exception);
    }

    const problem: ProblemDetails = {
      type: `https://fecpc.org/errors/${code.toLowerCase()}`,
      title,
      status,
      code,
      detail,
      error: firstFieldError(errors) ?? detail,
      requestId,
      ...(errors ? { errors } : {}),
    };

    response.status(status).header('Content-Type', 'application/problem+json').send(problem);
  }
}

/** The 4xx/5xx status a non-Nest error (Fastify's, a plugin's) asks for, if any. */
function httpStatusOf(e: unknown): number | undefined {
  const n = (e as { statusCode?: unknown } | null)?.statusCode;
  return typeof n === 'number' && n >= 400 && n <= 599 ? n : undefined;
}

/** "name: Too short" reads better than "The request payload … failed validation." */
function firstFieldError(errors?: Record<string, string[]>): string | undefined {
  const [path, msgs] = Object.entries(errors ?? {})[0] ?? [];
  if (!path || !msgs?.[0]) return undefined;
  return path === 'body' ? msgs[0] : `${path}: ${msgs[0]}`;
}
