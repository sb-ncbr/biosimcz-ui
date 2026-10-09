import { beforeEach, describe, expect, it, vi } from "vitest";
import { MDPOSIT_CAPABILITIES, MDREPO_CAPABILITIES, type RecordDetail } from "@/entities/record";
import { setTestEnv } from "@/test/serverEnv";
import { withDetailFallback } from "./fallbackDetail";
import type { RecordRepository } from "./types";

const record = (id: string) => ({ id }) as RecordDetail;

const repository = (capabilities: RecordRepository["capabilities"], get: RecordRepository["get"]): RecordRepository => ({
  capabilities,
  search: vi.fn(),
  get: vi.fn(get),
});

beforeEach(() => setTestEnv());

describe("withDetailFallback", () => {
  it("returns the primary record without asking the secondary", async () => {
    const primary = repository(MDPOSIT_CAPABILITIES, async (id) => record(`p-${id}`));
    const secondary = repository(MDREPO_CAPABILITIES, async (id) => record(`s-${id}`));
    expect((await withDetailFallback(primary, secondary).get("a"))?.id).toBe("p-a");
    expect(secondary.get).not.toHaveBeenCalled();
  });

  it("asks the secondary when the primary does not know the id", async () => {
    const primary = repository(MDPOSIT_CAPABILITIES, async () => null);
    const secondary = repository(MDREPO_CAPABILITIES, async (id) => record(`s-${id}`));
    expect((await withDetailFallback(primary, secondary).get("a"))?.id).toBe("s-a");
  });

  it("treats a failing secondary as not found, but lets a failing primary through", async () => {
    const missing = repository(MDPOSIT_CAPABILITIES, async () => null);
    const broken = repository(MDREPO_CAPABILITIES, async () => {
      throw new Error("down");
    });
    expect(await withDetailFallback(missing, broken).get("a")).toBeNull();
    const failing = repository(MDPOSIT_CAPABILITIES, async () => {
      throw new Error("primary down");
    });
    await expect(withDetailFallback(failing, broken).get("a")).rejects.toThrow("primary down");
  });

  it("searches and describes itself through the primary only", () => {
    const primary = repository(MDPOSIT_CAPABILITIES, async () => null);
    const wrapped = withDetailFallback(primary, repository(MDREPO_CAPABILITIES, async () => null));
    expect(wrapped.capabilities).toBe(MDPOSIT_CAPABILITIES);
    expect(wrapped.search).toBe(primary.search);
  });
});
