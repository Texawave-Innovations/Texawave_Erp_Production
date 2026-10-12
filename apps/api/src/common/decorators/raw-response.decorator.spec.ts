import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { RAW_RESPONSE_KEY, RawResponse } from "./raw-response.decorator.js";

describe("RawResponse", () => {
  it("marks a handler with rawResponse=true", () => {
    class Probe {
      @RawResponse()
      health() {}
    }
    expect(RAW_RESPONSE_KEY).toBe("rawResponse");
    expect(Reflect.getMetadata(RAW_RESPONSE_KEY, Probe.prototype.health)).toBe(
      true,
    );
  });

  it("can mark a whole controller class", () => {
    @RawResponse()
    class Probe {}
    expect(Reflect.getMetadata(RAW_RESPONSE_KEY, Probe)).toBe(true);
  });

  it("leaves undecorated handlers without metadata", () => {
    class Probe {
      plain() {}
    }
    expect(
      Reflect.getMetadata(RAW_RESPONSE_KEY, Probe.prototype.plain),
    ).toBeUndefined();
  });
});
