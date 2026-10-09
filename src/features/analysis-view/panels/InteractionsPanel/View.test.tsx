import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/viewers/echarts")>()),
  ...(await import("../testing/matrixChartsMock")).matrixChartsMock,
}));

import InteractionsPanel from "./View";

const context = { instanceId: "MD-A1.1", analysisName: "interactions", frameStepNs: null, atoms: null };
const withResidues = (n1: number) => ({
  name: "Pocket",
  agent_1: "protein",
  agent_2: "ligand",
  residue_indices_1: Array.from({ length: n1 }, (_, i) => i),
  residue_indices_2: [0, 1],
  interface_indices_1: [0],
  interface_indices_2: [1],
});
const data = [withResidues(4), { name: "Bare", agent_1: "a", agent_2: "b" }];

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("InteractionsPanel", () => {
  it("draws the categorical 4 class scale and the proper plural", () => {
    render(<InteractionsPanel context={context} data={data} />);
    expect(screen.getByTestId("heatmap")).toHaveAttribute("data-kind", "categorical");
    expect(screen.getByTestId("heatmap")).toHaveAttribute("data-classes", "4");
    expect(screen.getByText(/4 residues - Interface 1/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("indexs");
  });

  it("states the binning explicitly when the scale turns continuous", () => {
    render(<InteractionsPanel context={context} data={[withResidues(300)]} />);
    expect(screen.getByTestId("heatmap")).toHaveAttribute("data-kind", "continuous");
    expect(screen.getByText(/mean class/)).toBeInTheDocument();
  });

  it("keeps the select mounted when the chosen interaction has no lists", async () => {
    render(<InteractionsPanel context={context} data={data} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Interaction" }));
    await userEvent.click(await screen.findByRole("option", { name: "Bare" }));
    expect(screen.getByRole("status")).toHaveTextContent("were not provided");
    expect(screen.getByRole("combobox", { name: "Interaction" })).toHaveTextContent("Bare");
  });
});
