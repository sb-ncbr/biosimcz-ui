import { afterEach, describe, expect, it, vi } from "vitest";
import { safeFilename, saveBlob } from "./download";

describe("safeFilename", () => {
  it("replaces unsafe runs and falls back when nothing is left", () => {
    expect(safeFilename(" replica 1/rmsd ")).toBe("replica_1_rmsd");
    expect(safeFilename("///")).toBe("download");
  });
});

describe("saveBlob", () => {
  afterEach(() => vi.restoreAllMocks());

  it("clicks a temporary download link and revokes the object url", async () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    saveBlob(new Blob(["a"]), "a.csv");
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a")).toBeNull();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
    vi.useRealTimers();
  });
});
