import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReplicaBreadcrumb } from "./ReplicaBreadcrumb";

const segments = vi.hoisted(() => ({ value: [] as string[] }));
vi.mock("next/navigation", () => ({ useSelectedLayoutSegments: () => segments.value }));

describe("ReplicaBreadcrumb", () => {
  it("shows record, experiments, replica, tab and analysis label", () => {
    segments.value = ["analyses", "rmsd-pairwise-interface"];
    renderWithProviders(<ReplicaBreadcrumb accession="MD-A00001" recordTitle="POPC" replicaName="replica 1" />);
    expect(screen.getByRole("link", { name: "POPC" })).toHaveAttribute("href", "/records/MD-A00001");
    expect(screen.getByRole("link", { name: "Experiments" })).toHaveAttribute("href", "/records/MD-A00001/experiments");
    expect(screen.getByRole("link", { name: "replica 1" })).toHaveAttribute("href", "/records/MD-A00001/experiments/replica%201/overview");
    expect(screen.getByRole("link", { name: "Analyses" })).toHaveAttribute("href", "/records/MD-A00001/experiments/replica%201/analyses");
    expect(screen.getByText("RMSD Pairwise (Interface)")).toHaveAttribute("aria-current", "page");
  });

  it("ends at the tab without an analysis", () => {
    segments.value = ["trajectory"];
    renderWithProviders(<ReplicaBreadcrumb accession="MD-A00001" recordTitle="POPC" replicaName="replica_1" />);
    expect(screen.getByText("Trajectory")).toHaveAttribute("aria-current", "page");
  });
});
