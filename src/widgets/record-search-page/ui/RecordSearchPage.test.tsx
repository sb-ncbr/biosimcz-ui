import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MDPOSIT_CAPABILITIES, type RecordSearchResult, type RecordSummary } from "@/entities/record";
import { parseRecordQuery } from "@/features/record-search";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RecordSearchPage } from "./RecordSearchPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/records" }));

const summary = (id: string, title: string): RecordSummary => ({
  id,
  title,
  authors: ["Jana Novakova"],
  description: "A simulation.",
  publishedAt: "2026-02-12T09:00:00Z",
  doi: null,
  version: null,
  access: null,
  embargoUntil: null,
  license: null,
  communities: [],
  keywords: [],
  accession: id,
  engine: "GROMACS 2024.1",
  waterModel: "TIP3P",
  method: "Classical MD",
  replicaCount: 1,
  groups: [],
});

const result = (overrides: Partial<RecordSearchResult> = {}): RecordSearchResult => ({
  total: 2,
  page: 1,
  size: 20,
  items: [summary("MD-A00001", "Lysozyme in water"), summary("MD-A00002", "Ubiquitin in NaCl")],
  facets: { software: [{ key: "GROMACS", label: "GROMACS", count: 2 }] },
  repositoryTotal: 15190,
  facetsAvailable: true,
  ...overrides,
});

const render = (search: string, partial: Partial<RecordSearchResult> = {}) =>
  renderWithProviders(
    <RecordSearchPage query={parseRecordQuery(new URLSearchParams(search), MDPOSIT_CAPABILITIES)} result={result(partial)} capabilities={MDPOSIT_CAPABILITIES} />,
  );

describe("RecordSearchPage", () => {
  it("renders the H1, the search form, the filters, the count and the cards", () => {
    render("");
    expect(screen.getByRole("heading", { level: 1, name: "Repository of molecular dynamics simulations" })).toBeInTheDocument();
    expect(screen.getByRole("search")).toHaveAttribute("action", "/records");
    expect(screen.getByRole("complementary", { name: "Filters" })).toBeInTheDocument();
    // The visible count and the live status region.
    expect(screen.getAllByText("2 simulations")).toHaveLength(2);
    expect(screen.getAllByTestId("record-card")).toHaveLength(2);
    expect(screen.queryByText("About MDRepo")).not.toBeInTheDocument();
  });

  it("shows chips for active filters and keeps the search value", () => {
    render("?q=lysozyme&software=GROMACS");
    expect(screen.getByRole("searchbox", { name: "Search records" })).toHaveValue("lysozyme");
    expect(within(screen.getByRole("list", { name: "Active filters" })).getByText("Engine: GROMACS")).toBeInTheDocument();
  });

  it("explains an empty result and an empty repository", () => {
    const { unmount } = render("?q=zzzz", { total: 0, items: [] });
    expect(screen.getByRole("heading", { name: "No records match" })).toBeInTheDocument();
    unmount();
    render("", { total: 0, items: [], repositoryTotal: 0 });
    expect(screen.getByRole("heading", { name: "No simulations yet" })).toBeInTheDocument();
  });
});
