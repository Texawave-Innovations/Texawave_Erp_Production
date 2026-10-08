import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { RAW_RESPONSE_KEY } from "../decorators/raw-response.decorator.js";
import { PaginatedResponseDto } from "../dto/paginated-response.dto.js";
import { ResponseInterceptor } from "./response.interceptor.js";

const handler = () => undefined;
class Controller {}

function setup(isRaw: boolean | undefined, value: unknown) {
  const getAllAndOverride = vi.fn(() => isRaw);
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const context = {
    getHandler: () => handler,
    getClass: () => Controller,
  } as unknown as ExecutionContext;
  const handle = vi.fn(() => of(value));
  const next: CallHandler<unknown> = { handle };
  const interceptor = new ResponseInterceptor(reflector);
  return { interceptor, context, next, handle, getAllAndOverride };
}

describe("ResponseInterceptor", () => {
  it("wraps a plain result as { data } and checks handler then class metadata", async () => {
    const { interceptor, context, next, getAllAndOverride } = setup(undefined, {
      id: 1,
      name: "Tag",
    });

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({ data: { id: 1, name: "Tag" } });
    expect(getAllAndOverride).toHaveBeenCalledWith(RAW_RESPONSE_KEY, [
      handler,
      Controller,
    ]);
  });

  it("wraps a null result too", async () => {
    const { interceptor, context, next } = setup(false, null);
    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({ data: null });
  });

  it("unwraps a PaginatedResponseDto into data + meta", async () => {
    const page = new PaginatedResponseDto([{ id: 1 }, { id: 2 }], 45, 2, 20);
    const { interceptor, context, next } = setup(false, page);

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 2, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it("does not treat a look-alike plain object as paginated", async () => {
    const lookAlike = { items: [], total: 0, page: 1, limit: 20 };
    const { interceptor, context, next } = setup(false, lookAlike);

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({ data: lookAlike });
  });

  it("passes a @RawResponse() route through untouched", async () => {
    const raw = { status: "ok" };
    const { interceptor, context, next, handle } = setup(true, raw);

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBe(raw);
    expect(handle).toHaveBeenCalledTimes(1);
  });
});
