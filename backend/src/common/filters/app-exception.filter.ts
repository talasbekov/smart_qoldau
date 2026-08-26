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
  // Обрыв слишком большой загрузки: multer через FileInterceptor.limits
  // прерывает поток, @nestjs/platform-express превращает это в
  // PayloadTooLargeException. Без строки здесь клиент получал бы на 413
  // код INTERNAL, то есть «у нас сломалось» вместо «файл великоват».
  413: 'FILE_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
};

// Сообщения для ошибок, которые порождает не наш код, а фреймворк: его
// тексты английские, а клиент показывает `error.message` пользователю.
const MESSAGE_BY_STATUS: Record<number, string> = {
  413: 'Файл слишком большой',
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
    const fields =
      typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
    // `code` в теле есть только у ошибок, которые бросили мы сами (apiError и
    // ValidationPipe): у них и сообщение своё. У ошибок фреймворка код и
    // текст берутся из таблиц по статусу.
    const ours = 'code' in fields;
    const code = ours
      ? (fields.code as string)
      : (CODE_BY_STATUS[status] ?? 'INTERNAL');
    const message = ours
      ? String(fields.message)
      : (MESSAGE_BY_STATUS[status] ??
        ('message' in fields
          ? String(fields.message)
          : 'Internal server error'));
    const details = 'details' in fields ? fields.details : undefined;
    res
      .status(status)
      .json({ error: { code, message, ...(details ? { details } : {}) } });
  }
}
