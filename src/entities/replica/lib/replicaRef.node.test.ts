import { describe, expect, it } from "vitest";
import { replicaHref } from "./href";
import { isAccession, isInstanceId, resolveReplica } from "./replicaRef";

const names = ["replica 1", "100% a", "replica_3"];

describe("resolveReplica", () => {
  it("maps position + 1 to the instance id", () => {
    expect(resolveReplica("MD-A00001", names, "replica_3")).toEqual({
      accession: "MD-A00001",
      name: "replica_3",
      number: 3,
      instanceId: "MD-A00001.3",
    });
  });

  it("handles names with spaces and percent signs", () => {
    expect(resolveReplica("MD-A00001", names, "replica 1")?.instanceId).toBe("MD-A00001.1");
    expect(resolveReplica("MD-A00001", names, "100% a")?.number).toBe(2);
  });

  it("returns null for an unknown name", () => {
    expect(resolveReplica("MD-A00001", names, "nope")).toBeNull();
    expect(resolveReplica("MD-A00001", [], "replica 1")).toBeNull();
  });
});

describe("id guards", () => {
  it("tells accessions from instance ids", () => {
    expect(isAccession("MD-A00001")).toBe(true);
    expect(isAccession("MD-A00001.2")).toBe(false);
    expect(isInstanceId("MD-A00001.2")).toBe(true);
    expect(isInstanceId("MD-A00001")).toBe(false);
    expect(isInstanceId("MD-A00001.0")).toBe(false);
    expect(isInstanceId("../x.1")).toBe(false);
  });
});

describe("replicaHref", () => {
  it("encodes every segment", () => {
    expect(replicaHref("MD-A00001", "100% a/b", "analyses", "rmsd pairwise")).toBe(
      "/records/MD-A00001/experiments/100%25%20a%2Fb/analyses/rmsd%20pairwise",
    );
    expect(replicaHref("MD-A00001", "replica 1")).toBe("/records/MD-A00001/experiments/replica%201");
  });
});
