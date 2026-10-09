import { describe, expect, it } from "vitest";
import { structureUrlFor, trajectoryUrlFor } from "./urls";

describe("molstar URL helpers", () => {
  it("point at our BFF, never at MDposit", () => {
    expect(structureUrlFor("MD-A00001")).toBe("/bff/records/MD-A00001/structure");
    expect(trajectoryUrlFor("MD-A00001.1")).toBe("/bff/records/MD-A00001.1/trajectory");
  });

  it("encodes the id as one path segment", () => {
    expect(structureUrlFor("a/b?c")).toBe("/bff/records/a%2Fb%3Fc/structure");
  });

  it("adds selection and frames as an encoded query, skipping blanks", () => {
    expect(structureUrlFor("MD-A00001", "resname ALA & name CA")).toBe("/bff/records/MD-A00001/structure?selection=resname+ALA+%26+name+CA");
    expect(trajectoryUrlFor("MD-A00001.1", { frames: "1:100:10", selection: "protein" })).toBe(
      "/bff/records/MD-A00001.1/trajectory?frames=1%3A100%3A10&selection=protein",
    );
    expect(trajectoryUrlFor("MD-A00001.1", { frames: "", selection: undefined })).toBe("/bff/records/MD-A00001.1/trajectory");
  });
});
