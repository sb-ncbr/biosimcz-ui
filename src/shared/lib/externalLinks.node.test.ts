import { describe, expect, it } from "vitest";
import { doiUrl, orcidUrl } from "./externalLinks";

describe("doiUrl", () => {
  it("builds a doi.org link for a valid DOI", () => {
    expect(doiUrl("10.1234/mdrepo.4821")).toBe("https://doi.org/10.1234/mdrepo.4821");
  });

  it("encodes the path and escapes query and fragment delimiters", () => {
    expect(doiUrl("10.1234/a b?x#y")).toBeNull();
    expect(doiUrl("10.1234/a<b>?x#y")).toBe("https://doi.org/10.1234/a%3Cb%3E%3Fx%23y");
  });

  it.each(["javascript:alert(1)", "https://evil.example/10.1234/x", "10.12/abc", "10.1234/", "10.1234/a b", "", null, undefined])(
    "rejects %s",
    (value) => {
      expect(doiUrl(value)).toBeNull();
    },
  );
});

describe("orcidUrl", () => {
  it("accepts a well-formed ORCID iD and rejects others", () => {
    expect(orcidUrl("0000-0002-1825-009X")).toBe("https://orcid.org/0000-0002-1825-009X");
    expect(orcidUrl("../evil")).toBeNull();
    expect(orcidUrl(null)).toBeNull();
  });
});
