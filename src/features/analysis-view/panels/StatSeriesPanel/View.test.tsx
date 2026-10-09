import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/viewers/echarts", async () => (await import("../testing/echartsMock")).echartsMock);

import StatSeriesPanel from "./View";

const context = { instanceId: "MD-A1.1", analysisName: "rgyr", frameStepNs: null, atoms: null };
const stats = { mean: 1, std: 0.5, min: 0, max: 2, count: 3 };

describe("StatSeriesPanel", () => {
  it("renders one chart, a strip per series and a summary with units", () => {
    render(
      <StatSeriesPanel
        context={context}
        config={{ title: "Radius of gyration", quantity: "Rg", seriesNames: { rgyr: "Rg", rgyrx: "Rg X" } }}
        data={{
          start: 0,
          step: 6,
          series: [
            { key: "rgyr", stats, data: [0, 1, 2] },
            { key: "rgyrx", stats, data: [0, 1, 2] },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-series", "Rg|Rg X");
    expect(screen.getByLabelText("Rg statistics")).toHaveTextContent("1.000 nm?");
    expect(screen.getByLabelText("Rg X statistics")).toBeInTheDocument();
    expect(screen.getByTestId("summary")).toHaveTextContent("Rg: mean 1.000 nm?");
  });

  it("shows the empty reason without a chart when there are no points", () => {
    render(<StatSeriesPanel context={context} data={{ start: 0, step: 1, series: [{ key: "rmsd", stats, data: [] }] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("No data points in this analysis");
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });
});
