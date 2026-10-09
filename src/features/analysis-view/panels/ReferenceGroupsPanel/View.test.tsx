import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/viewers/echarts", async () => (await import("../testing/echartsMock")).echartsMock);

import ReferenceGroupsPanel from "./View";

const context = {
  instanceId: "MD-A1.1",
  analysisName: "rmsds",
  frameStepNs: null,
  atoms: null,
};
const data = {
  start: 0,
  step: 1,
  references: ["firstframe", "average"],
  data: [
    { reference: "firstframe", group: "protein", values: [1, 2] },
    { reference: "average", group: "other", values: [3, 4] },
  ],
};

// Radix Select needs these jsdom gaps filled.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("ReferenceGroupsPanel", () => {
  it("keeps the select mounted while switching references", async () => {
    render(<ReferenceGroupsPanel context={context} data={data} config={{ title: "RMSD by reference", quantity: "RMSD" }} />);
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-series", "protein");
    await userEvent.click(screen.getByRole("combobox", { name: /Reference/ }));
    await userEvent.click(await screen.findByRole("option", { name: "average" }));
    expect(screen.getByRole("combobox", { name: /Reference/ })).toHaveTextContent("average");
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-series", "other");
  });

  it("shows the old empty message when there are no groups", () => {
    render(<ReferenceGroupsPanel context={context} data={{ start: 0, step: 1, references: [], data: [] }} />);
    expect(screen.getByText("No groups selected")).toBeInTheDocument();
  });

  it("lists the per-group stats inline", () => {
    render(<ReferenceGroupsPanel context={context} data={data} />);
    expect(screen.getByText("Avg: 1.500")).toBeInTheDocument();
  });

  it("passes the fixed y range for tmscores", () => {
    render(<ReferenceGroupsPanel context={{ ...context, analysisName: "tmscores" }} data={data} config={{ yRange: { min: 0, max: 1 } }} />);
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-ymin", "0");
  });
});
