import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lipidInterSchema } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseSynthetic } from "../testing/membraneFixtures";

type Cell = { row: number; col: number; value: number };

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    HeatmapChart: (p: { xLabels: string[]; tooltip: (c: Cell) => { label: string; value: string }[] }) => (
      <div
        data-testid="heatmap"
        data-labels={p.xLabels.join("|")}
        data-tip={p.tooltip({ row: 0, col: 0, value: 0.5 }).map((r) => `${r.label}=${r.value}`).join(";")}
      />
    ),
  };
});

const { default: LipidInterPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "lipid-inter", frameStepNs: null, atoms: null };

describe("LipidInterPanel (fixture-only synthetic data)", () => {
  it("shows the full InChI key in the tooltip and truncated unique axis labels", () => {
    renderWithProviders(<LipidInterPanel data={parseSynthetic(lipidInterSchema, "lipid-inter")} context={context} />);
    expect(screen.getByTestId("heatmap").getAttribute("data-tip")).toContain("Lipid=KLFCQYBPXXKHIA-UHFFFAOYSA-N");
    const labels = screen.getByTestId("heatmap").getAttribute("data-labels")!.split("|");
    expect(new Set(labels).size).toBe(labels.length);
    expect(screen.getByRole("combobox", { name: "Sort residues" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lipid" })).toBeInTheDocument();
  });

  it("keeps both selects mounted when every species is empty", () => {
    renderWithProviders(<LipidInterPanel data={{ residues: [1], lipids: [{ key: "K", values: [0] }] }} context={context} />);
    expect(screen.getByText("No lipid data available for the selected filter.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort residues" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lipid" })).toBeInTheDocument();
  });
});
