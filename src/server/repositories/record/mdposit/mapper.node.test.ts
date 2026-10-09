import { describe, expect, it } from "vitest";
import { mdpositProjects } from "@/mocks/fixtures/mdpositProjects";
import { projectSchema } from "../../../backends/mdposit/projectSchemas";
import { toDetail, toFacetOptions, toSummary } from "./mapper";

const parse = (raw: unknown) => projectSchema.parse(raw);

const fixture = (accession: string) => parse(mdpositProjects.find((project) => project.accession === accession));

describe("MDposit mapper", () => {
  it("maps a full project to a summary", () => {
    const summary = toSummary(fixture("MD-A00005"));
    expect(summary).toMatchObject({
      id: "MD-A00005",
      accession: "MD-A00005",
      title: "POPC membrane with cholesterol, 1 µs",
      authors: ["Jana Novakova", "Pavel Kovar"],
      engine: "GROMACS 2024.1",
      waterModel: "TIP3P",
      method: "Classical MD",
      replicaCount: 2,
      groups: ["Masaryk University, Membrane Lab"],
      access: null,
      doi: null,
      license: null,
    });
    expect(summary.publishedAt).toMatch(/^2026-01-06/);
  });

  it("copes with missing metadata fields", () => {
    const summary = toSummary(parse({ accession: "MD-X", metadata: { NAME: null, PROGRAM: null, AUTHORS: null } }));
    expect(summary).toMatchObject({ id: "MD-X", title: null, authors: [], engine: null, replicaCount: null, groups: [] });
    expect(toSummary(parse({ accession: "MD-Y" })).title).toBeNull();
  });

  it("reads VERSION as a number or a string and FF as a string or an array", () => {
    expect(toSummary(parse({ accession: "a", metadata: { PROGRAM: "Amber", VERSION: 20 } })).engine).toBe("Amber 20");
    expect(toSummary(parse({ accession: "a", metadata: { PROGRAM: "Amber", VERSION: " 20 " } })).engine).toBe("Amber 20");
    expect(toDetail(parse({ accession: "a", metadata: { FF: "CHARMM36" } })).simulation?.forceFields).toEqual(["CHARMM36"]);
    expect(toDetail(parse({ accession: "a", metadata: { FF: ["A", "B"] } })).simulation?.forceFields).toEqual(["A", "B"]);
  });

  it("tolerates wrongly typed fields instead of failing the project", () => {
    const summary = toSummary(parse({ accession: "a", metadata: { NAME: 5, AUTHORS: "not a list", TEMP: "hot" }, mdcount: "many" }));
    expect(summary.title).toBeNull();
    expect(summary.authors).toEqual([]);
  });

  it("maps the detail: simulation facts, license, citation, links and files", () => {
    const detail = toDetail(fixture("MD-A00005"));
    expect(detail.simulation).toMatchObject({ method: "Classical MD", ensemble: "NPT", forceFields: ["CHARMM36m"], temperature: 310, timestep: 2, atoms: 52000, replicas: 2 });
    expect(detail.license).toContain("Creative Commons");
    expect(detail.licenseUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(detail.citation).toBe("DOI: 10.0000/example.2026");
    expect(detail.links).toEqual([{ label: "Paper", url: "https://example.org/paper" }]);
    expect(detail.files?.map((file) => file.key)).toContain("popc-chol.xtc");
    expect(detail.files?.[0]).toEqual({ key: "structure.pdb", size: null, mimetype: null });
  });

  it("maps contact, sequences, replica names, update date and total size", () => {
    const detail = toDetail(
      parse({
        accession: "a",
        metadata: { CONTACT: " s.xie@example.org ", PROTSEQ: ["MSG IVI\nDKE", " "], NUCLSEQ: ["ACGT"] },
        mds: ["replica_1", "replica_2"],
        updateDate: "2026-07-10T14:47:56.832Z",
        totalSize: 31187961038,
      }),
    );
    expect(detail.contact).toBe("s.xie@example.org");
    expect(detail.sequences).toEqual([
      { kind: "protein", sequence: "MSGIVIDKE" },
      { kind: "nucleic", sequence: "ACGT" },
    ]);
    expect(detail.replicaNames).toEqual(["replica_1", "replica_2"]);
    expect(detail.updatedAt).toBe("2026-07-10T14:47:56.832Z");
    expect(detail.totalSize).toBe(31187961038);
  });

  it("leaves the new detail fields empty when MDposit omits or mistypes them", () => {
    const detail = toDetail(parse({ accession: "a", metadata: { CONTACT: 5, PROTSEQ: "MSG", NUCLSEQ: null }, totalSize: "big" }));
    expect(detail).toMatchObject({ contact: null, sequences: [], replicaNames: [], updatedAt: null, totalSize: null });
  });

  it("drops links that are not http(s)", () => {
    const detail = toDetail(
      parse({
        accession: "a",
        metadata: {
          LINKCENSE: "javascript:alert(1)",
          LINKS: [
            { name: "Good", url: "https://example.org/a" },
            { name: "Bad", url: "javascript:alert(1)" },
            { name: "Data", url: "data:text/html,x" },
            { name: "Relative", url: "/etc/passwd" },
            { url: "http://example.org/no-name" },
            "not an object",
            null,
          ],
        },
      }),
    );
    expect(detail.licenseUrl).toBeNull();
    expect(detail.links).toEqual([
      { label: "Good", url: "https://example.org/a" },
      { label: "http://example.org/no-name", url: "http://example.org/no-name" },
    ]);
  });

  it("maps options to facet options: drops the null bucket, sorts by count, numbers ascending", () => {
    const software = toFacetOptions("software", { "metadata.PROGRAM": { Amber: 5, GROMACS: 9, null: 3, "": 1, $where: 1 } });
    expect(software).toEqual([
      { key: "GROMACS", label: "GROMACS", count: 9 },
      { key: "Amber", label: "Amber", count: 5 },
    ]);
    expect(toFacetOptions("temp", { "metadata.TEMP": { "310": 1, "298": 4, "300": 2 } }).map((option) => option.key)).toEqual(["298", "300", "310"]);
    expect(toFacetOptions("software", {})).toEqual([]);
    expect(toFacetOptions("access", { "metadata.PROGRAM": { A: 1 } })).toEqual([]);
  });

  it("rejects a project without an accession so the adapter can skip it", () => {
    expect(projectSchema.safeParse({ metadata: {} }).success).toBe(false);
    expect(projectSchema.safeParse({ accession: "" }).success).toBe(false);
  });
});
