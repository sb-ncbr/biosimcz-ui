import { describe, expect, it } from "vitest";
import { accessLabel, formatEdited, formatPublished, licenseLabel, structureLabel } from "./format";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatEdited", () => {
  it("uses relative wording up to a month, then the date", () => {
    expect(formatEdited(ago(10_000), NOW)).toBe("Edited just now");
    expect(formatEdited(ago(5 * MIN), NOW)).toBe("Edited 5 min ago");
    expect(formatEdited(ago(2 * HOUR), NOW)).toBe("Edited 2 h ago");
    expect(formatEdited(ago(3 * DAY), NOW)).toBe("Edited 3 d ago");
    expect(formatEdited(ago(7 * DAY), NOW)).toBe("Edited 1 week ago");
    expect(formatEdited(ago(21 * DAY), NOW)).toBe("Edited 3 weeks ago");
    expect(formatEdited("2026-02-12T09:00:00Z", NOW)).toBe("Edited 12 Feb 2026");
  });

  it("treats a future timestamp (clock skew) as just now and garbage as empty", () => {
    expect(formatEdited(new Date(NOW + HOUR).toISOString(), NOW)).toBe("Edited just now");
    expect(formatEdited("not a date", NOW)).toBe("");
  });
});

describe("labels", () => {
  it("formats the publication date in UTC", () => {
    expect(formatPublished("2026-02-12T23:30:00Z")).toBe("Published 12 Feb 2026");
    expect(formatPublished(null)).toBe("Published");
  });

  it("formats license ids", () => {
    expect(licenseLabel("cc-by-4.0")).toBe("CC BY 4.0");
    expect(licenseLabel("cc0-1.0")).toBe("CC0 1.0");
    expect(licenseLabel(null)).toBeNull();
    expect(licenseLabel("  ")).toBeNull();
  });

  it("formats structures by source", () => {
    expect(structureLabel({ source: "pdb", id: "1UBQ" })).toBe("PDB 1UBQ");
    expect(structureLabel({ source: "alphafold", id: "P12345" })).toBe("AlphaFold P12345");
    expect(structureLabel({ source: "custom", id: null })).toBe("Custom structure");
    expect(structureLabel(null)).toBeNull();
  });

  it("shows the embargo date when there is one", () => {
    expect(accessLabel({ access: "embargoed", embargoUntil: "2027-03-01" })).toBe("Embargoed until 1 Mar 2027");
    expect(accessLabel({ access: "embargoed", embargoUntil: null })).toBe("Embargoed");
    expect(accessLabel({ access: "open", embargoUntil: null })).toBe("Open");
    expect(accessLabel({ access: null, embargoUntil: null })).toBeNull();
  });
});
