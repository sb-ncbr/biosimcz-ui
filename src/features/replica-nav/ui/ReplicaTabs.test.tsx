import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReplicaTabs } from "./ReplicaTabs";

const segment = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => segment.value }));

describe("ReplicaTabs", () => {
  it("renders links and marks only the active segment", () => {
    segment.value = "analyses";
    renderWithProviders(<ReplicaTabs accession="MD-A00001" replicaName="replica_1" />);
    expect(screen.getByRole("link", { name: "Analyses" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Trajectory viewer" })).toHaveAttribute("href", "/records/MD-A00001/experiments/replica_1/trajectory");
  });

  it("does not activate Trajectory for a replica named trajectory_1", () => {
    segment.value = "overview";
    renderWithProviders(<ReplicaTabs accession="MD-A00001" replicaName="trajectory_1" />);
    expect(screen.getByRole("link", { name: "Trajectory viewer" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("activates nothing on an unknown segment", () => {
    segment.value = null;
    renderWithProviders(<ReplicaTabs accession="MD-A00001" replicaName="trajectory_1" />);
    expect(document.querySelector("[aria-current]")).toBeNull();
  });
});
