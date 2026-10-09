import { describe, expect, it } from "vitest";
import { problemMessage } from "./messages";

describe("problemMessage", () => {
  it("maps the client-side size cap key to fixed prose", () => {
    expect(problemMessage({ kind: "client", messageKey: "errors.download.too_large" })).toContain("512 MiB");
  });
});
