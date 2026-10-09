import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/viewers/echarts", async () => (await import("../testing/echartsMock")).echartsMock);

import RmsdPerResiduePanel from "./View";

const context = {
  instanceId: "MD-A1.1",
  analysisName: "rmsd-perres",
  frameStepNs: null,
  atoms: null,
};
const data = {
  step: 2,
  residues: [
    { name: "ALA 1", values: [1, 2] },
    { name: "ALA 1", values: [3, 4] },
  ],
};

// Radix Select needs these jsdom gaps filled.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("RmsdPerResiduePanel", () => {
  it("lets duplicate residue names be chosen independently", async () => {
    render(<RmsdPerResiduePanel context={context} data={data} />);
    await userEvent.click(screen.getByRole("combobox", { name: /Residue/ }));
    const options = await screen.findAllByRole("option", { name: "ALA 1" });
    await userEvent.click(options[1]!);
    expect(screen.getByText("Avg: 3.500")).toBeInTheDocument();
  });

  it("shows the old empty message without residues", () => {
    render(<RmsdPerResiduePanel context={context} data={{ step: 1, residues: [] }} />);
    expect(screen.getByText("No RMSD per residue data available.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("hides the select for a single residue", () => {
    render(<RmsdPerResiduePanel context={context} data={{ step: 1, residues: [{ name: "ALA 1", values: [1, 3] }] }} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Avg: 2.000")).toBeInTheDocument();
  });
});
