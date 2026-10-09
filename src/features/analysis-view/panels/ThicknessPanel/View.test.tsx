import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { thicknessSchema } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseSynthetic } from "../testing/membraneFixtures";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    LineChart: (p: { series: { name: string; band?: unknown }[] }) => (
      <div data-testid="line" data-bands={p.series.filter((s) => s.band).length} data-names={p.series.map((s) => s.name).join("|")} />
    ),
  };
});

const { default: ThicknessPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "thickness", frameStepNs: null, atoms: null };

describe("ThicknessPanel (fixture-only synthetic data)", () => {
  it("renders the banded leaflet chart and the midplane chart", () => {
    renderWithProviders(<ThicknessPanel data={parseSynthetic(thicknessSchema, "thickness")} context={context} />);
    const lines = screen.getAllByTestId("line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("data-bands", "3");
    expect(screen.getByText(/Thickness mean/)).toBeInTheDocument();
  });

  it("shows the midplane empty reason without midplane data", () => {
    const data = { step: 1, frame: [0, 1], thickness: [40, 41] };
    renderWithProviders(<ThicknessPanel data={data} context={context} />);
    expect(screen.getByText("No midplane data provided.")).toBeInTheDocument();
  });
});
