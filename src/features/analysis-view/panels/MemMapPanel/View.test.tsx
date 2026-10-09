import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { memMapSchema } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseSynthetic } from "../testing/membraneFixtures";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    BarChart: (p: { categories: string[]; tooltip?: (i: number) => { label: string; value: string }[] }) => (
      <div data-testid="bars" data-cats={p.categories.join("|")} data-tip={p.tooltip?.(0).map((r) => `${r.label}=${r.value}`).join(";")} />
    ),
  };
});

const { default: MemMapPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "mem-map", frameStepNs: null, atoms: null };

describe("MemMapPanel (fixture-only synthetic data)", () => {
  it("draws one bar per membrane with tooltip rows and keeps the filter mounted", () => {
    renderWithProviders(<MemMapPanel data={parseSynthetic(memMapSchema, "mem-map")} context={context} />);
    expect(screen.getByTestId("bars")).toHaveAttribute("data-cats", "Membrane 1|Membrane 2");
    expect(screen.getByTestId("bars").getAttribute("data-tip")).toContain("Top leaflet=30");
    expect(screen.getByRole("combobox", { name: "Filter membranes" })).toBeInTheDocument();
    expect(screen.getByText("Indices")).toBeInTheDocument();
  });

  it("shows the empty reason but keeps the filter without membranes", () => {
    renderWithProviders(<MemMapPanel data={{ n_mems: null, ids: [], mems: {}, no_mem_lipid: [4] }} context={context} />);
    expect(screen.getByText("No leaflet assignments provided for the selected membrane.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter membranes" })).toBeInTheDocument();
  });
});
