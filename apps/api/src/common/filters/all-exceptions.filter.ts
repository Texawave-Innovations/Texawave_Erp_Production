import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ClsService } from "nestjs-cls";
import { BusinessException } from "../exceptions/business.exception.js";

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  correlationId: string | undefined;
}

/**
 * Catches every thrown error and turns it into one consistent response shape
 * (Docs/CODING_STANDARDS.md §7). Never includes a stack trace in the
 * response body, in any environment — the full error goes to structured
 * logs only, keyed by `correlationId`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = this.cls.isActive()
      ? this.cls.get<string>("correlationId")
      : undefined;

    const { status, message, error } = this.resolve(exception);

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} (${error})`,
      );
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof BusinessException) {
      const body = exception.getResponse();
      return {
        status: exception.getStatus(),
        message:
          typeof body === "string"
            ? body
            : (body as { message: string }).message,
        // Set via the HttpException options in every BusinessException
        // subclass's constructor — always present, hence the assertion.
        error: exception.errorCode as string,
      };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "string") {
        return {
          status: exception.getStatus(),
          message: body,
          error: exception.name,
        };
      }
      const { message, error } = body as {
        message?: string | string[];
        error?: string;
      };
      return {
        status: exception.getStatus(),
        message: message ?? exception.message,
        error: error ?? exception.name,
      };
    }

    // Anything else is unexpected — never leak its message to the client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      error: "InternalServerError",
    };
  }
}
