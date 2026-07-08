import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type HttpResponseBody = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  error?: unknown;
};

type HttpResponse = {
  status(statusCode: number): {
    json(body: ErrorEnvelope): void;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDefaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "VALIDATION_ERROR";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

function getDefaultMessage(statusCode: number): string {
  if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
    return "Đã có lỗi xảy ra";
  }

  return "Yêu cầu không hợp lệ";
}

function parseHttpExceptionResponse(exception: HttpException): HttpResponseBody {
  const response = exception.getResponse();

  if (typeof response === "string") {
    return { message: response };
  }

  if (isRecord(response)) {
    return response;
  }

  return {};
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException ? parseHttpExceptionResponse(exception) : {};

    if (!(exception instanceof HttpException)) {
      if (exception instanceof Error) {
        this.logger.error(exception.message, exception.stack);
      } else {
        this.logger.error("Unhandled non-error exception", String(exception));
      }
    }

    const code =
      typeof body.code === "string" ? body.code : getDefaultErrorCode(statusCode);
    const message =
      typeof body.message === "string" ? body.message : getDefaultMessage(statusCode);
    const details = "details" in body ? body.details : undefined;

    response.status(statusCode).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }
}
