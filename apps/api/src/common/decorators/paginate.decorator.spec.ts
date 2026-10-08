import "reflect-metadata";
import { BadRequestException, type ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants.js";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { describe, expect, it } from "vitest";
import { PaginationDto } from "../dto/pagination.dto.js";
import { Paginate } from "./paginate.decorator.js";

type Factory = (data: unknown, ctx: ExecutionContext) => PaginationDto;

/** Pulls the factory + bound `data` Nest registered for the parameter, so
 * the decorator runs exactly as the router would invoke it. */
function resolveParam(decorated: ParameterDecorator) {
  class Probe {
    handler(_q: unknown) {}
  }
  decorated(Probe.prototype, "handler", 0);
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, "handler") as
    Record<string, { factory: Factory; data: unknown }> | undefined;
  const entry = Object.values(args ?? {})[0];
  if (!entry) throw new Error("param decorator registered no metadata");
  return (query: Record<string, unknown>) =>
    entry.factory(entry.data, {
      switchToHttp: () => ({ getRequest: () => ({ query }) }),
    } as unknown as ExecutionContext);
}

class QueryTagDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(5)
  search?: string;
}

describe("@Paginate()", () => {
  it("applies PaginationDto defaults on an empty query", () => {
    const run = resolveParam(Paginate());
    const dto = run({});
    expect(dto).toBeInstanceOf(PaginationDto);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.skip).toBe(0);
  });

  it("coerces string query params to numbers", () => {
    const run = resolveParam(Paginate());
    const dto = run({ page: "3", limit: "10", order: "desc" });
    expect(dto).toMatchObject({ page: 3, limit: 10, order: "desc" });
    expect(dto.skip).toBe(20);
  });

  it("rejects out-of-range values with a 400 listing every constraint", () => {
    const run = resolveParam(Paginate());
    let caught: unknown;
    try {
      run({ page: "0", limit: "1000", order: "sideways" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const messages = (
      (caught as BadRequestException).getResponse() as { message: string[] }
    ).message;
    expect(messages).toHaveLength(3);
    expect(messages.join(" | ")).toMatch(/page must not be less than 1/);
    expect(messages.join(" | ")).toMatch(/limit must not be greater than 100/);
    expect(messages.join(" | ")).toMatch(/order must be one of/);
  });

  it("validates extra fields when a subclass DTO is passed", () => {
    const run = resolveParam(Paginate(QueryTagDto));
    const dto = run({ search: "abc", page: "2" });
    expect(dto).toBeInstanceOf(QueryTagDto);
    expect((dto as QueryTagDto).search).toBe("abc");
    expect(() => run({ search: "far-too-long" })).toThrow(BadRequestException);
  });
});
