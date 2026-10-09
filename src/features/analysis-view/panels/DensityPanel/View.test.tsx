import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { densitySchema } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseSynthetic } from "../testing/membraneFixtures";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    LineChart: (p: { series: { name: string }[]; y: { unit?: { text: string } | null } }) => (
      <div data-testid="line" data-names={p.series.map((s) => s.name).join("|")} data-unit={p.y.unit?.text} />
    ),
  };
});

const { default: DensityPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "density", frameStepNs: null, atoms: null };

describe("DensityPanel (fixture-only synthetic data)", () => {
  it("shows the default metric with its unit and both selects", () => {
    renderWithProviders(<DensityPanel data={parseSynthetic(densitySchema, "density")} context={context} />);
    expect(screen.getByTestId("line")).toHaveAttribute("data-names", "Water|Lipid");
    expect(screen.getByTestId("line")).toHaveAttribute("data-unit", "#/Å^3");
    expect(screen.getByRole("combobox", { name: "Metric" })).toHaveTextContent("Number density");
    expect(screen.getByRole("combobox", { name: "Value" })).toHaveTextContent("Density");
  });

  it("keeps the selects mounted without components", () => {
    renderWithProviders(<DensityPanel data={{ z: [], comps: [] }} context={context} />);
    expect(screen.getByText("No matching density data available for the selected metric.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Metric" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Value" })).toBeInTheDocument();
    expect(screen.getByText("No components in this analysis")).toBeInTheDocument();
  });
});
