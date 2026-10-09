import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AddRunButton } from "./AddRunButton";
import { RunsOverview } from "./RunsOverview";
import { draftWith, renderInDraft, runsNow } from "./testUtils";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/depositions/d1/experiments", useRouter: () => ({ push }) }));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ revision: 2, updatedAt: "2026-09-30T00:01:00Z" }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

const production = {
  name: "Production",
  simulationType: "molecular_dynamics" as const,
  ensemble: "NpT" as const,
  length: 100,
  temperature: { referenceK: 310 },
  pressure: { referenceBar: 1 },
};

describe("RunsOverview", () => {
  it("shows the empty state with the type menu when there are no runs", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith(), <RunsOverview />);
    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add run/i }));
    expect(await screen.findByRole("menuitem", { name: /energy minimization/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /free energy simulation/i })).toBeInTheDocument();
  });

  it("adds a run of the chosen type and opens its editor", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith(production), (
      <>
        <AddRunButton />
        <RunsOverview />
      </>
    ));
    await user.click(screen.getByRole("button", { name: /add run/i }));
    await user.click(await screen.findByRole("menuitem", { name: /molecular dynamics/i }));
    await waitFor(() => expect(runsNow()).toHaveLength(2));
    const added = runsNow()[1];
    expect(added).toMatchObject({ name: "Molecular dynamics", simulationType: "molecular_dynamics" });
    expect(push).toHaveBeenCalledWith(`/depositions/d1/experiments/${added?.id}`);
  });

  it("lists runs with their summary and the required count", () => {
    renderInDraft(draftWith(production, { name: "Minimization", simulationType: "energy_minimization", length: 50000, fileKeys: ["em.tpr"] }), <RunsOverview />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    const first = within(rows[1] as HTMLElement);
    expect(first.getByRole("link", { name: "Production" })).toHaveAttribute("href", "/depositions/d1/experiments/r1");
    expect(first.getByText("NpT")).toBeInTheDocument();
    expect(first.getByText("100 ns")).toBeInTheDocument();
    expect(first.getByText("310 K")).toBeInTheDocument();
    expect(first.getByText("1 bar")).toBeInTheDocument();
    expect(first.getByText(/4 required/)).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("50,000 steps")).toBeInTheDocument();
  });

  it("duplicates a run below its source", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith(production, { name: "Next" }), <RunsOverview />);
    const table = screen.getByRole("table");
    await user.click(within(table).getByRole("button", { name: "More actions for Production" }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    await waitFor(() => expect(runsNow().map((run) => run.name)).toEqual(["Production", "Production (copy)", "Next"]));
  });

  it("asks before deleting a run and removes it on confirm", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith(production, { name: "Next" }), <RunsOverview />);
    const table = screen.getByRole("table");
    await user.click(within(table).getByRole("button", { name: "More actions for Production" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete run" }));
    expect(await screen.findByText("Delete run Production?")).toBeInTheDocument();
    expect(runsNow()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Delete run" }));
    await waitFor(() => expect(runsNow().map((run) => run.name)).toEqual(["Next"]));
  });

  it("keeps the run when the delete is cancelled", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith(production), <RunsOverview />);
    await user.click(within(screen.getByRole("table")).getByRole("button", { name: "More actions for Production" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete run" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(runsNow()).toHaveLength(1);
  });

  it("moves a run down", async () => {
    const user = userEvent.setup();
    renderInDraft(draftWith({ name: "A" }, { name: "B" }), <RunsOverview />);
    await user.click(within(screen.getByRole("table")).getByRole("button", { name: "More actions for A" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move down" }));
    await waitFor(() => expect(runsNow().map((run) => run.name)).toEqual(["B", "A"]));
  });
});
