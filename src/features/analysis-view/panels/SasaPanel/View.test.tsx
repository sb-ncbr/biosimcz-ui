import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SasaData } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    LineChart: (p: { series: { name: string; yAxis?: number }[]; y2?: unknown }) => (
      <div data-testid="line" data-axes={p.series.map((s) => s.yAxis ?? 0).join(",")} data-y2={String(Boolean(p.y2))} />
    ),
    BarChart: (p: { categories: string[] }) => <div data-testid="bars" data-order={p.categories.join("|")} />,
  };
});

const { default: SasaPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "sasa", frameStepNs: null, atoms: null };
const data: SasaData = {
  step: 5,
  perResidue: [Float64Array.from([1, 1]), Float64Array.from([5, 7])],
  total: Float64Array.from([6, 8]),
};

describe("SasaPanel", () => {
  it("overlays the selected residue on a second y axis and ranks bars largest first", () => {
    renderWithProviders(<SasaPanel data={data} context={context} />);
    expect(screen.getByTestId("line")).toHaveAttribute("data-axes", "0,1");
    expect(screen.getByTestId("line")).toHaveAttribute("data-y2", "true");
    expect(screen.getByTestId("bars")).toHaveAttribute("data-order", "Residue 2|Residue 1");
    expect(screen.getByRole("combobox", { name: "Residue" })).toHaveTextContent("Residue 1");
  });

  it("keeps the select mounted without samples", () => {
    renderWithProviders(<SasaPanel data={{ step: 1, perResidue: [], total: new Float64Array(0) }} context={context} />);
    expect(screen.getByRole("combobox", { name: "Residue" })).toBeInTheDocument();
    expect(screen.getByText("No SASA samples in this analysis")).toBeInTheDocument();
  });
});
