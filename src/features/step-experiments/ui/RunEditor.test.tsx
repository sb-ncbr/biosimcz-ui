import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RunEditor } from "./RunEditor";
import { draftWith, renderInDraft, runsNow } from "./testUtils";

vi.mock("next/navigation", () => ({ usePathname: () => "/depositions/d1/experiments/r1", useRouter: () => ({ push: vi.fn() }) }));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ revision: 2, updatedAt: "2026-09-30T00:01:00Z" }), { status: 200 })));
  window.sessionStorage.clear();
  window.location.hash = "";
});
afterEach(() => vi.unstubAllGlobals());

const heading = (name: string) => screen.queryByRole("button", { name: new RegExp(name), expanded: true });

describe("RunEditor", () => {
  it("shows only Experiment files and Basics (Name, Simulation type) before a type is chosen (195:2572)", () => {
    renderInDraft(draftWith({ name: "Production" }), <RunEditor runId="r1" />);
    expect(heading("Experiment files")).toBeInTheDocument();
    expect(heading("Basics")).toBeInTheDocument();
    expect(heading("Temperature")).not.toBeInTheDocument();
    expect(heading("Pressure")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Production");
    expect(screen.getByRole("combobox", { name: /Simulation type/ })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ensemble" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sections you can add")).not.toBeInTheDocument();
    expect(screen.getAllByText("1 required")).toHaveLength(2);
  });

  it("reveals the dynamics sections once a type is chosen and saves it to the draft", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith({ name: "Production" }), <RunEditor runId="r1" />);
    await user.click(screen.getByRole("combobox", { name: /Simulation type/ }));
    await user.click(await screen.findByRole("option", { name: "Molecular dynamics" }));
    expect(await screen.findByRole("radiogroup", { name: "Ensemble" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Length/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Time step/)).toBeInTheDocument();
    expect(screen.getByText("Sections you can add")).toBeInTheDocument();
    expect(runsNow()[0]?.simulationType).toBe("molecular_dynamics");
    expect(screen.getByText("Ensemble, Length added.")).toBeInTheDocument();
  });

  it("adds Temperature for NVT and Pressure for NpT", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith({ name: "Run", simulationType: "molecular_dynamics" }), <RunEditor runId="r1" />);
    expect(heading("Temperature")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "NVT" }));
    expect(await screen.findByRole("button", { name: /Temperature/, expanded: true })).toBeInTheDocument();
    expect(heading("Pressure")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "NpT" }));
    expect(await screen.findByRole("button", { name: /Pressure/, expanded: true })).toBeInTheDocument();
    expect(runsNow()[0]?.ensemble).toBe("NpT");
  });

  it("hides Temperature and Pressure for energy minimization and labels the length in steps", () => {
    renderInDraft(draftWith({ name: "Min", simulationType: "energy_minimization", ensemble: "NpT" }), <RunEditor runId="r1" />);
    expect(heading("Temperature")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ensemble" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Time step/)).not.toBeInTheDocument();
    expect(screen.getByText("steps")).toBeInTheDocument();
  });

  it("writes typed values into the run", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith({ name: "Run", simulationType: "molecular_dynamics", ensemble: "NVE" }), <RunEditor runId="r1" />);
    await user.type(screen.getByLabelText(/^Length/), "100");
    await user.type(screen.getByLabelText(/^Time step/), "2");
    await waitFor(() => expect(runsNow()[0]).toMatchObject({ length: 100, timeStep: 2 }));
  });

  it("turns a ghost section into a full one, and removes it again", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith({ name: "Run", simulationType: "molecular_dynamics", ensemble: "NVE" }), <RunEditor runId="r1" />);
    await user.click(screen.getByRole("button", { name: "Add Electrostatics" }));
    expect(await screen.findByRole("button", { name: /Electrostatics/, expanded: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Electrostatics" })).not.toBeInTheDocument();
    expect(runsNow()[0]?.electrostatics).toEqual({});
    await user.click(screen.getByRole("button", { name: "Remove section" }));
    await waitFor(() => expect(runsNow()[0]?.electrostatics).toBeUndefined());
    expect(screen.getByRole("button", { name: "Add Electrostatics" })).toBeInTheDocument();
  });

  it("explains hidden sections that still hold values", () => {
    renderInDraft(
      draftWith({ name: "Run", simulationType: "molecular_dynamics", ensemble: "NVE", temperature: { referenceK: 300 } }),
      <RunEditor runId="r1" />,
    );
    expect(screen.getByText(/Temperature is hidden for NVE/)).toBeInTheDocument();
  });

  it("shows empty required fields after Go to field", async () => {
    window.location.hash = "#field-basics-length";
    renderInDraft(draftWith({ name: "Run", simulationType: "molecular_dynamics", ensemble: "NVE" }), <RunEditor runId="r1" />);
    expect(await screen.findByText("Enter how long the run was.")).toBeInTheDocument();
    await act(async () => {});
    expect(window.sessionStorage.getItem("mdrepo:show-required:d1")).toBe("1");
  });

  it("renders nothing for an unknown run", () => {
    const { container } = renderInDraft(draftWith({ name: "Run" }), <RunEditor runId="nope" />);
    expect(container.querySelector("form")).toBeNull();
  });
});
