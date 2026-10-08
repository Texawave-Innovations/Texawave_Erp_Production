import {
  BadRequestException,
  type ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { ClsService } from "nestjs-cls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../exceptions/business.exception.js";
import { AllExceptionsFilter } from "./all-exceptions.filter.js";

function makeCls(active: boolean, correlationId?: string): ClsService {
  return {
    isActive: vi.fn(() => active),
    get: vi.fn(() => correlationId),
  } as unknown as ClsService;
}

function makeHost(url = "/api/v1/things", method = "GET") {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url, method }),
    }),
  } as unknown as ArgumentsHost;
  const body = () => json.mock.calls[0]?.[0] as Record<string, unknown>;
  return { host, status, json, body };
}

describe("AllExceptionsFilter", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps a BusinessException to its status, message and errorCode", () => {
    const filter = new AllExceptionsFilter(makeCls(true, "corr-123"));
    const { host, status, body } = makeHost("/api/v1/employees/7");

    filter.catch(new ResourceNotFoundException("Employee", 7), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(body()).toEqual({
      statusCode: 404,
      message: "Employee not found: 7",
      error: "RESOURCE_NOT_FOUND",
      path: "/api/v1/employees/7",
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown,
      correlationId: "corr-123",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "GET /api/v1/employees/7 -> 404 (RESOURCE_NOT_FOUND)",
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("uses the custom errorCode of a 422 business rule violation", () => {
    const filter = new AllExceptionsFilter(makeCls(false));
    const { host, body } = makeHost();

    filter.catch(
      new BusinessRuleViolationException("End before start", "DATE_RANGE"),
      host,
    );

    expect(body()).toMatchObject({
      statusCode: 422,
      message: "End before start",
      error: "DATE_RANGE",
    });
  });

  it("omits correlationId when CLS is not active, without reading CLS", () => {
    const cls = makeCls(false, "should-not-be-read");
    const filter = new AllExceptionsFilter(cls);
    const { host, body } = makeHost();

    filter.catch(new NotFoundException(), host);

    expect(body().correlationId).toBeUndefined();
    expect(cls.get).not.toHaveBeenCalled();
  });

  it("keeps validation messages (string[]) and error from a built-in HttpException", () => {
    const filter = new AllExceptionsFilter(makeCls(true, "c1"));
    const { host, status, body } = makeHost("/api/v1/tags", "POST");

    filter.catch(
      new BadRequestException(["name must be a string", "name too long"]),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(body()).toMatchObject({
      statusCode: 400,
      message: ["name must be a string", "name too long"],
      error: "Bad Request",
      path: "/api/v1/tags",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "POST /api/v1/tags -> 400 (Bad Request)",
    );
  });

  it("uses the string body and exception name for an HttpException with a string response", () => {
    const filter = new AllExceptionsFilter(makeCls(false));
    const { host, body } = makeHost();

    filter.catch(new HttpException("Teapot here", 418), host);

    expect(body()).toMatchObject({
      statusCode: 418,
      message: "Teapot here",
      error: "HttpException",
    });
  });

  it("falls back to exception.message and name when an object body lacks message and error", () => {
    const filter = new AllExceptionsFilter(makeCls(false));
    const { host, body } = makeHost();
    const ex = new HttpException({ detail: "x" }, HttpStatus.FORBIDDEN);

    filter.catch(ex, host);

    expect(body()).toMatchObject({
      statusCode: 403,
      message: ex.message,
      error: "HttpException",
    });
  });

  it("logs a 5xx HttpException at error level with the stack", () => {
    const filter = new AllExceptionsFilter(makeCls(false));
    const { host, body } = makeHost("/x", "DELETE");
    const ex = new HttpException("down", HttpStatus.SERVICE_UNAVAILABLE);

    filter.catch(ex, host);

    expect(body().statusCode).toBe(503);
    expect(errorSpy).toHaveBeenCalledWith("DELETE /x -> 503", ex.stack);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("turns an unknown Error into a generic 500 without leaking its message or stack", () => {
    const filter = new AllExceptionsFilter(makeCls(true, "corr-9"));
    const { host, status, json, body } = makeHost();
    const secret = new Error(
      "connect ECONNREFUSED 10.0.0.5:5432 password=hunter2",
    );

    filter.catch(secret, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(body()).toEqual({
      statusCode: 500,
      message: "Internal server error",
      error: "InternalServerError",
      path: "/api/v1/things",
      timestamp: expect.any(String) as unknown,
      correlationId: "corr-9",
    });
    const serialized = JSON.stringify(json.mock.calls[0]);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("ECONNREFUSED");
    expect(Object.keys(body())).not.toContain("stack");
    // The full detail goes to the log only.
    expect(errorSpy).toHaveBeenCalledWith(
      "GET /api/v1/things -> 500",
      secret.stack,
    );
  });

  it("treats a Prisma known-request error (not an HttpException) as an opaque 500", () => {
    const filter = new AllExceptionsFilter(makeCls(false));
    const { host, body } = makeHost();
    const prismaErr = Object.assign(
      new Error("Unique constraint failed on the fields: (`email`)"),
      {
        code: "P2002",
        meta: { target: ["email"] },
        name: "PrismaClientKnownRequestError",
      },
    );

    filter.catch(prismaErr, host);

    expect(body()).toMatchObject({
      statusCode: 500,
      message: "Internal server error",
      error: "InternalServerError",
    });
    expect(JSON.stringify(body())).not.toContain("email");
    expect(JSON.stringify(body())).not.toContain("P2002");
  });

  it("stringifies a non-Error throwable for the log", () => {
    const filter = new AllExceptionsFilter(makeCls(false));
    const { host, body } = makeHost();

    filter.catch("plain string thrown", host);

    expect(body().statusCode).toBe(500);
    expect(body().message).toBe("Internal server error");
    expect(errorSpy).toHaveBeenCalledWith(
      "GET /api/v1/things -> 500",
      "plain string thrown",
    );
  });

  it("does not leak a 4xx exception's stack into the body", () => {
    const filter = new AllExceptionsFilter(makeCls(false));
    const { host, body } = makeHost();

    filter.catch(new ForbiddenException("No access"), host);

    expect(body()).toMatchObject({
      statusCode: 403,
      message: "No access",
      error: "Forbidden",
    });
    expect(Object.keys(body()).sort()).toEqual([
      "correlationId",
      "error",
      "message",
      "path",
      "statusCode",
      "timestamp",
    ]);
  });
});
