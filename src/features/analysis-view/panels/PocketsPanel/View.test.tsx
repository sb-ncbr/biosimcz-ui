import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PocketsData } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    LineChart: (p: { series: { name: string }[] }) => <div data-testid="line" data-names={p.series.map((s) => s.name).join("|")} />,
    BarChart: (p: { categories: string[]; horizontal?: boolean }) => (
      <div data-testid="bars" data-order={p.categories.join("|")} data-horizontal={String(p.horizontal)} />
    ),
  };
});

const { default: PocketsPanel } = await import("./View");

const context = {
  instanceId: "MD-A1.1",
  analysisName: "pockets",
  frameStepNs: null,
  atoms: null,
};
const data: PocketsData = {
  start: 0,
  step: 10,
  data: [
    { name: "small", volumes: [1, 2], atoms: [1] },
    { name: "big", volumes: [10, 20], atoms: [1, 2] },
  ],
};

describe("PocketsPanel", () => {
  it("selects the first pocket on the first render and ranks the largest first", () => {
    renderWithProviders(<PocketsPanel data={data} context={context} />);
    expect(screen.getByRole("combobox", { name: "Pocket" })).toHaveTextContent("small");
    expect(screen.getByTestId("line")).toHaveAttribute("data-names", "small");
    expect(screen.getByTestId("bars")).toHaveAttribute("data-order", "big|small");
    expect(screen.getByTestId("bars")).toHaveAttribute("data-horizontal", "true");
  });

  it("shows the old empty message when there are no pockets", () => {
    renderWithProviders(<PocketsPanel data={{ start: 0, step: 1, data: [] }} context={context} />);
    expect(screen.getByText("No pocket analysis data available.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Pocket" })).not.toBeInTheDocument();
  });

  it("shows the average line and the total badge", () => {
    renderWithProviders(<PocketsPanel data={data} context={context} />);
    expect(screen.getByText("Avg: 1.500")).toBeInTheDocument();
    expect(screen.getByText("Atoms: 1")).toBeInTheDocument();
    expect(screen.getByText("Total pockets: 2")).toBeInTheDocument();
  });
});
