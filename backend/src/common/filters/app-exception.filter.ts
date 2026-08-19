import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
};

export function apiError(code: string, message: string, status: number): never {
  throw new HttpException({ code, message }, status);
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const code =
      typeof body === 'object' && body && 'code' in body
        ? (body as any).code
        : (CODE_BY_STATUS[status] ?? 'INTERNAL');
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as any).message)
        : 'Internal server error';
    const details =
      typeof body === 'object' && body && 'details' in body
        ? (body as any).details
        : undefined;
    res
      .status(status)
      .json({ error: { code, message, ...(details ? { details } : {}) } });
  }
}
