import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./protectedPaths";

// Section 5 of plans/oidc-auth.md: every page route and whether an anonymous visitor may open it.
const ROUTES: [string, boolean][] = [
  ["/", false],
  ["/records", false],
  ["/records/MD-A00001", false],
  ["/communities", false],
  ["/communities/biosim-cz", false],
  ["/communities/new", true],
  ["/communities/new/", true],
  ["/communities/biosim-cz/edit", true],
  ["/login", false],
  ["/depositions", true],
  ["/depositions/", true],
  ["/depositions/draft-1/study", true],
  ["/depositions/draft-1/system", true],
  ["/depositions/draft-1/experiments/run-2", true],
  ["/depositions/draft-1/review", true],
  ["/depositions/draft-1/published", true],
  ["/dev/primitives", false],
  ["/depositionsX", false],
];

describe("isProtectedPath", () => {
  it.each(ROUTES)("%s protected=%s", (path, protectedRoute) => {
    expect(isProtectedPath(path)).toBe(protectedRoute);
  });
});
