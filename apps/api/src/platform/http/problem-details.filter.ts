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

    const requestId =
      (request.headers['x-request-id'] as string) || (request.id as string) || 'unknown-request-id';

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
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      detail = typeof res === 'string' ? res : (res as any).message || exception.message;

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
      } else if (pgCode === '40001' || pgCode === '40P01') {
        // Serialization or deadlock
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
      requestId,
      ...(errors ? { errors } : {}),
    };

    response.status(status).header('Content-Type', 'application/problem+json').send(problem);
  }
}
