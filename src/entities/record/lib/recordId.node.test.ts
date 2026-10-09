import { describe, expect, it } from "vitest";
import { isRecordId } from "./recordId";

describe("isRecordId", () => {
  it.each(["MD-A00001", "MD-A00001.2", "pub-popc", "d_123", "a", "x".repeat(64)])("accepts %s", (id) => {
    expect(isRecordId(id)).toBe(true);
  });

  it.each(["", "..", "a..b", "../etc", "a/b", "a b", ".hidden", "-lead", "x".repeat(65), "a?b", "a#b", "a%2Fb", 5, null, undefined])("rejects %s", (id) => {
    expect(isRecordId(id)).toBe(false);
  });
});
