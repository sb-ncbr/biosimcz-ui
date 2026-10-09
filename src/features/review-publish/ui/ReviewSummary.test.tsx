import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft } from "@/entities/deposition";
import { completeDraft, productionRun } from "@/test/depositionFixtures";
import { ReviewSummary } from "./ReviewSummary";
import { renderInWizard } from "./testUtils";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/depositions/d1/review",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

const box = () => screen.getByRole("region", { name: /left$|to fix$|problems?$/ });

describe("ReviewSummary with missing fields", () => {
  it("lists what is left with a Go to field link that carries the anchor", async () => {
    const draft = completeDraft();
    draft.study.title = "";
    draft.runs = [productionRun({ id: "run-a", name: "Production replica 3", length: undefined })];
    renderInWizard(draft, <ReviewSummary />);

    expect(within(box()).getByRole("heading", { name: "2 required fields left" })).toBeInTheDocument();
    const title = within(box()).getByRole("link", { name: /Go to field.*Title/ });
    expect(title).toHaveAttribute("href", "/depositions/d1/study#field-basics-title");
    const length = within(box()).getByRole("link", { name: /Go to field.*Length/ });
    expect(length).toHaveAttribute("href", "/depositions/d1/experiments/run-a#field-basics-length");
    expect(within(box()).getByText("Experiments - Production replica 3")).toBeInTheDocument();

    await userEvent.click(title);
    expect(window.sessionStorage.getItem("mdrepo:show-required:d1")).toBe("1");
  });

  it("marks a missing required value in its step block and shows the experiments table with the missing cell", () => {
    const draft = completeDraft();
    draft.study.title = "";
    draft.runs = [productionRun({ length: undefined })];
    renderInWizard(draft, <ReviewSummary />);

    const study = screen.getByRole("region", { name: "Study details" });
    expect(within(study).getByText("Missing")).toBeInTheDocument();
    expect(within(study).getAllByText("Not provided").length).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    const row = within(table).getByRole("row", { name: /Production/ });
    expect(within(row).getByText("missing")).toBeInTheDocument();
    expect(within(row).getByText("NpT")).toBeInTheDocument();
    expect(within(row).getByText("310 K")).toBeInTheDocument();
    expect(within(row).getByText("1 bar")).toBeInTheDocument();
  });

  it("shows the required count for an empty draft and an Edit link per step", () => {
    renderInWizard(emptyDraft(), <ReviewSummary />);
    expect(within(box()).getByRole("heading", { name: "14 required fields left" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Study details" })).toHaveAttribute("href", "/depositions/d1/study");
    expect(screen.getByRole("link", { name: "Edit Molecular system" })).toHaveAttribute("href", "/depositions/d1/system");
    expect(screen.getByRole("link", { name: "Edit Experiments" })).toHaveAttribute("href", "/depositions/d1/experiments");
    expect(screen.getByText(/Add each run of your protocol/)).toBeInTheDocument();
  });

  it("shows only eight rows and expands on Show all", async () => {
    renderInWizard(emptyDraft(), <ReviewSummary />);
    expect(within(box()).getAllByRole("listitem")).toHaveLength(8);
    await userEvent.click(within(box()).getByRole("button", { name: /Show all 14/ }));
    expect(within(box()).getAllByRole("listitem")).toHaveLength(14);
  });

  it("lists format problems with a Fix link", () => {
    const draft = completeDraft();
    draft.study.doi = "10.12";
    renderInWizard(draft, <ReviewSummary />);
    expect(within(box()).getByRole("heading", { name: "1 field to fix" })).toBeInTheDocument();
    expect(within(box()).getByRole("link", { name: /Fix.*DOI/ })).toHaveAttribute("href", "/depositions/d1/study#field-basics-doi");
  });
});

describe("ReviewSummary when everything is filled in", () => {
  it("replaces the box by a success alert and summarises every step", () => {
    const draft = completeDraft();
    draft.study.keywords = ["lysozyme", "protein dynamics"];
    draft.study.access = "embargoed";
    draft.study.embargo = { until: "2031-03-01", reason: "Paper under review" };
    draft.system.molecules = [{ type: "protein", name: "Lysozyme C", chains: ["A"], residues: 129 }];
    renderInWizard(draft, <ReviewSummary />);

    expect(screen.getByText("Everything required is filled in")).toBeInTheDocument();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();

    const study = screen.getByRole("region", { name: "Study details" });
    expect(within(study).getByText("Lysozyme in water")).toBeInTheDocument();
    expect(within(study).getByText("lysozyme")).toBeInTheDocument();
    expect(within(study).getByText(/Files open on 1 Mar 2031 - Paper under review/)).toBeInTheDocument();
    expect(within(study).getByText("Jana Novakova")).toBeInTheDocument();
    expect(within(study).getByText("MDRepo")).toBeInTheDocument();

    const system = screen.getByRole("region", { name: "Molecular system" });
    expect(within(system).getByText("GROMACS 2023.1")).toBeInTheDocument();
    expect(within(system).getByText("CHARMM36m")).toBeInTheDocument();
    expect(within(system).getByText("33,940 atoms")).toBeInTheDocument();
    expect(within(system).getByText("7.3 × 7.3 × 7.3 nm")).toBeInTheDocument();
    expect(within(system).getByText("Protein - 1 chain - 129 residues")).toBeInTheDocument();
    expect(within(system).getByText("topol.top")).toBeInTheDocument();

    const experiments = screen.getByRole("region", { name: "Experiments" });
    expect(within(experiments).getByText("100 ns")).toBeInTheDocument();
    expect(within(experiments).getByText("md.tpr")).toBeInTheDocument();
  });

  it("shows box angles only for shapes that have them", () => {
    const draft = completeDraft();
    draft.system.box = { shape: "triclinic", a: 6.82, b: 7.14, c: 6.55, alpha: 90, beta: 104.2, gamma: 90 };
    renderInWizard(draft, <ReviewSummary />);
    expect(screen.getByText("90° · 104.2° · 90°")).toBeInTheDocument();
    expect(screen.getByText("Triclinic")).toBeInTheDocument();
  });
});
