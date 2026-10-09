import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { aplSchema } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseSynthetic } from "../testing/membraneFixtures";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    LineChart: (p: { series: { band?: unknown }[] }) => <div data-testid="line" data-band={String(Boolean(p.series[0]?.band))} />,
    HeatmapChart: (p: { xLabels?: string[]; scale: { min?: number; max?: number } }) => (
      <div data-testid="heatmap" data-first-label={p.xLabels?.[0]} data-range={`${p.scale.min}:${p.scale.max}`} />
    ),
  };
});

const { default: AplPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "apl", frameStepNs: null, atoms: null };

describe("AplPanel (fixture-only synthetic data)", () => {
  it("draws both leaflets with one shared range, grid labels and a median band", () => {
    renderWithProviders(<AplPanel data={parseSynthetic(aplSchema, "apl")} context={context} />);
    const maps = screen.getAllByTestId("heatmap");
    expect(maps).toHaveLength(2);
    expect(maps[0]!.getAttribute("data-range")).toBe(maps[1]!.getAttribute("data-range"));
    expect(maps[0]).toHaveAttribute("data-first-label", "0.0");
    expect(screen.getByTestId("line")).toHaveAttribute("data-band", "true");
  });

  it("shows empty reasons for missing leaflets and no line chart for a scalar median", () => {
    const data = { upper: [], lower: [], gridX: [], gridY: [], median: [3], std: [1] };
    renderWithProviders(<AplPanel data={data} context={context} />);
    expect(screen.getByText("No upper leaflet grid data provided.")).toBeInTheDocument();
    expect(screen.queryByTestId("line")).not.toBeInTheDocument();
  });
});
