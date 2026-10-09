import { describe, expect, it } from "vitest";
import { mockLookups } from "./lookups";

describe("mockLookups", () => {
  it("verifies the known ORCID and rejects unknown or malformed ones", async () => {
    const found = await mockLookups.orcid("0000-0002-1825-0097");
    expect(found).toMatchObject({ status: "verified", record: { familyName: "Carberry" } });
    expect((await mockLookups.orcid("0000-0001-2345-6789")).status).toBe("not_found");
    expect((await mockLookups.orcid("nope")).status).toBe("not_found");
  });

  it("finds organisations by name and by ROR id, with or without the URL prefix", async () => {
    expect((await mockLookups.organisations("masaryk")).map((org) => org.name)).toEqual(["Masaryk University"]);
    expect((await mockLookups.organisationByRor("02j46qs45"))?.name).toBe("Masaryk University");
    expect((await mockLookups.organisationByRor("https://ror.org/02j46qs45"))?.name).toBe("Masaryk University");
    expect(await mockLookups.organisationByRor("0zzzzzzzz")).toBeNull();
  });

  it("reserves a DOI derived from the draft id", async () => {
    expect(await mockLookups.generateDoi("abc")).toBe("10.1234/mdrepo.abc");
  });
});
