import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestEnv } from "@/test/serverEnv";
import { parseResultSchema } from "./schemas";

describe("E-D6 parse result detected_role", () => {
  beforeEach(() => setTestEnv({ LOG_LEVEL: "debug" }));
  afterEach(() => vi.restoreAllMocks());

  it("accepts starting_structure", () => {
    expect(parseResultSchema.parse({ status: "ok", detected_role: "starting_structure" }).detected_role).toBe("starting_structure");
  });

  it("maps an unknown role to other with a warning instead of failing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = parseResultSchema.safeParse({ status: "ok", detected_role: "future_role", fields: [] });
    expect(result.success).toBe(true);
    expect(result.data?.detected_role).toBe("other");
    expect(String(warn.mock.calls[0]?.[0])).toContain("future_role");
  });
});
