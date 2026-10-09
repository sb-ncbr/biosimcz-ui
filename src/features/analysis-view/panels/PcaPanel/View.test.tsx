import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PcaData } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    BarChart: (p: { categories: string[] }) => <div data-testid="scree" data-count={p.categories.length} />,
    ScatterChart: (p: { x: ArrayLike<number>; color?: ArrayLike<number> }) => (
      <div data-testid="scatter" data-points={p.x.length} data-color={p.color?.length ?? 0} />
    ),
  };
});

const { default: PcaPanel } = await import("./View");

const context = {
  instanceId: "MD-A1.1",
  analysisName: "pca",
  frameStepNs: null,
  atoms: null,
};
const data: PcaData = {
  eigenvalues: [4, 2, 1],
  projections: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
  components: 3,
};

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("PcaPanel", () => {
  it("colours every projected frame and keeps both axis selects", () => {
    renderWithProviders(<PcaPanel data={data} context={context} />);
    expect(screen.getByTestId("scatter")).toHaveAttribute("data-points", "3");
    expect(screen.getByTestId("scatter")).toHaveAttribute("data-color", "3");
    expect(screen.getByTestId("scree")).toHaveAttribute("data-count", "3");
    expect(screen.getByRole("combobox", { name: "X-axis" })).toHaveTextContent("PC 1");
    expect(screen.getByRole("combobox", { name: "Y-axis" })).toHaveTextContent("PC 2");
  });

  it("keeps the selects mounted when there is nothing to plot", () => {
    renderWithProviders(<PcaPanel data={{ eigenvalues: [], projections: [[], []], components: 2 }} context={context} />);
    expect(screen.getByRole("combobox", { name: "X-axis" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Y-axis" })).toBeInTheDocument();
    expect(screen.getByText("No projections to plot")).toBeInTheDocument();
    expect(screen.queryByTestId("scatter")).not.toBeInTheDocument();
  });
});
