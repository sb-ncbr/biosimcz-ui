import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { EnergiesData, EnergyAgent } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    LineChart: (p: { series: { name: string; stack?: string }[] }) => (
      <div data-testid="line" data-stacks={p.series.map((s) => s.stack ?? "-").join(",")} />
    ),
  };
});

const { default: EnergiesPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "energies-00", frameStepNs: null, atoms: null };

const stage = (values: number[]) => ({ es: values, vdw: values, both: values });
const agent = (values: number[]): EnergyAgent => ({
  labels: [],
  stages: { overall: stage(values), initial: stage(values), final: stage([]) },
});
const data: EnergiesData = { data: [{ name: "Protein-ligand", agent1: agent([1, -3, 2]), agent2: agent([]) }] };

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("EnergiesPanel", () => {
  it("stacks electrostatic and VdW only and names unlabelled items as atoms", () => {
    renderWithProviders(<EnergiesPanel data={data} context={context} />);
    const stacks = screen.getAllByTestId("line").map((el) => el.getAttribute("data-stacks"));
    expect(stacks).toEqual(["-,-,-", "energy,energy,-"]);
    expect(screen.getByText("2. Atom 2")).toBeInTheDocument();
  });

  it("keeps all three selects when the chosen stage has no data and lets the user switch back", async () => {
    renderWithProviders(<EnergiesPanel data={data} context={context} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Stage" }));
    await userEvent.click(await screen.findByRole("option", { name: "Final" }));

    expect(screen.queryByTestId("line")).not.toBeInTheDocument();
    for (const name of ["Interaction", "Agent", "Stage"]) expect(screen.getByRole("combobox", { name })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: "Stage" }));
    await userEvent.click(await screen.findByRole("option", { name: "Overall" }));
    expect(screen.getAllByTestId("line")).toHaveLength(2);
  });

  it("shows the empty reason for an agent without values", async () => {
    renderWithProviders(<EnergiesPanel data={data} context={context} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Agent" }));
    await userEvent.click(await screen.findByRole("option", { name: "Agent 2" }));
    expect(screen.getAllByText(/No energy values for this selection/).length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "Agent" })).toHaveTextContent("Agent 2");
  });
});
