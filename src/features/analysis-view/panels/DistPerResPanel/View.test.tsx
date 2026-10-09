import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/viewers/echarts")>()),
  ...(await import("../testing/matrixChartsMock")).matrixChartsMock,
}));

import DistPerResPanel from "./View";

const context = { instanceId: "MD-A1.1", analysisName: "dist-perres", frameStepNs: null, atoms: null };
const data = {
  data: [
    { name: "Overall", means: [[3, 1, 2]], stdvs: [[0.1, 0.9, 0.5]] },
    { name: "Only means", means: [[4, 5]], stdvs: null },
  ],
};

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("DistPerResPanel", () => {
  it("shows Closest pairs in the mean view and Most variable pairs in the std view", async () => {
    render(<DistPerResPanel context={context} data={data} />);
    expect(screen.getByRole("heading", { name: "Closest residue pairs" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "View" }));
    await userEvent.click(await screen.findByRole("option", { name: "Std. deviation" }));
    expect(screen.getByRole("heading", { name: "Most variable residue pairs" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Closest residue pairs" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Agent 1 residue 2 - Agent 2 residue 1");
  });

  it("keeps both selects mounted when the chosen view has no matrix", async () => {
    render(<DistPerResPanel context={{ ...context, analysisName: "dist-perres-stdv" }} data={data} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Interaction" }));
    await userEvent.click(await screen.findByRole("option", { name: "Only means" }));
    expect(screen.getByRole("status")).toHaveTextContent("no distance variability matrix");
    expect(screen.getByRole("combobox", { name: "Interaction" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "View" })).toHaveTextContent("Std. deviation");
  });

  it("keeps a disabled interaction select for empty data", () => {
    render(<DistPerResPanel context={context} data={{ data: [] }} />);
    expect(screen.getByRole("combobox", { name: "Interaction" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("No distance-per-residue data");
  });
});
