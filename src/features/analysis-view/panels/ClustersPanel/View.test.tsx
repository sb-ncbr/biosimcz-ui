import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClustersData } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";

type Cell = { row: number; col: number; value: number };

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    BarChart: (p: { categories: string[] }) => <div data-testid="bars" data-order={p.categories.join("|")} />,
    HeatmapChart: (p: { matrix: { rows: number; cols: number }; tooltip?: (cell: Cell) => { label: string; value: string }[] }) => (
      <div
        data-testid="heatmap"
        data-size={`${p.matrix.rows}x${p.matrix.cols}`}
        data-tooltip={p
          .tooltip?.({ row: 0, col: 1, value: 5 })
          .map((r) => `${r.label}=${r.value}`)
          .join(";")}
      />
    ),
  };
});

const { default: ClustersPanel } = await import("./View");

const context = {
  instanceId: "MD-A1.1",
  analysisName: "clusters-00",
  frameStepNs: null,
  atoms: null,
};
const data: ClustersData = {
  name: "Overall",
  cutoff: 0.3,
  step: 1,
  version: "0.1.0",
  clusters: [
    { frames: [1], main: 10 },
    { frames: [2, 3], main: 20 },
  ],
  transitions: [{ from: 0, to: 1, count: 5 }],
};

describe("ClustersPanel", () => {
  it("draws populations largest first and a from/to tooltip on the count heatmap", () => {
    renderWithProviders(<ClustersPanel data={data} context={context} />);
    expect(screen.getByTestId("bars")).toHaveAttribute("data-order", "Cluster 2 (frame 20)|Cluster 1 (frame 10)");
    expect(screen.getByTestId("heatmap")).toHaveAttribute("data-size", "2x2");
    expect(screen.getByTestId("heatmap")).toHaveAttribute("data-tooltip", "From=Cluster 1 (frame 10);To=Cluster 2 (frame 20);Count=5");
    expect(screen.getByText("Cluster 1 (frame 10) → Cluster 2 (frame 20)")).toBeInTheDocument();
  });

  it("shows the old empty message without clusters", () => {
    renderWithProviders(<ClustersPanel data={{ ...data, clusters: [], transitions: [] }} context={context} />);
    expect(screen.getByText("No clustering data available.")).toBeInTheDocument();
    expect(screen.queryByTestId("heatmap")).not.toBeInTheDocument();
  });

  it("shows intro, badges and the top-transitions section", () => {
    renderWithProviders(<ClustersPanel data={data} context={context} />);
    expect(screen.getByText("Conformational clustering")).toBeInTheDocument();
    expect(screen.getByText("1 transitions")).toBeInTheDocument();
    expect(screen.getByText("Most frequent transitions")).toBeInTheDocument();
  });
});
