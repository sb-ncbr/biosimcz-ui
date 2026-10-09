import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/viewers/echarts")>()),
  ...(await import("../testing/matrixChartsMock")).matrixChartsMock,
}));

import HbondsPanel from "./View";

const context = { instanceId: "MD-A1.1", analysisName: "hbonds", frameStepNs: null, atoms: null };
const entry = (name: string, timed: number[][]) => ({
  name,
  donors: [10, 11],
  acceptors: [20, 21],
  hydrogens: [30, 31],
  occupancy: [0.37, 0.8],
  timed: timed.map((row) => Float64Array.from(row)),
});
const data = {
  interactions: [
    entry("First", [[0.5, 0.2], [1, 1]]),
    entry("No series", []),
  ],
};

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("HbondsPanel", () => {
  it("renders the line, the heatmap and the top occupancy list", () => {
    render(<HbondsPanel context={context} data={data} />);
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-series", "Bonds formed");
    expect(screen.getByTestId("heatmap")).toHaveTextContent("formed in 50% of frames");
    expect(screen.getByRole("region", { name: "Top occupancy bonds" })).toHaveTextContent("Bond 2: D 11 -> A 21 (H 31)");
  });

  it("keeps the select mounted when an interaction has no per-block series", async () => {
    render(<HbondsPanel context={context} data={data} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Interaction" }));
    await userEvent.click(await screen.findByRole("option", { name: "No series" }));
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("no per-block series");
    expect(screen.getByRole("combobox", { name: "Interaction" })).toHaveTextContent("No series");
    expect(screen.getByRole("region", { name: "Top occupancy bonds" })).toBeInTheDocument();
  });

  it("shows empty reasons and a disabled select without interactions", () => {
    render(<HbondsPanel context={context} data={{ interactions: [] }} />);
    expect(screen.getByRole("combobox", { name: "Interaction" })).toBeDisabled();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("No hydrogen bond data");
  });
});
