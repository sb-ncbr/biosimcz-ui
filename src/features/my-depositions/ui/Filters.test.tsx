import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepositionFacets } from "@/entities/deposition";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseListQuery } from "../model/urlState";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { ControlsRow } from "./ControlsRow";
import { FiltersColumn } from "./FiltersColumn";
import { ListNavigationProvider } from "./ListNavigation";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  usePathname: () => "/depositions",
}));
vi.mock("../actions", () => ({ deleteDraft: vi.fn() }));

const facets: DepositionFacets = {
  created: [
    { key: "2025-03", count: 1 },
    { key: "2026-09", count: 2 },
  ],
  options: {
    access: [{ key: "open", label: "open", count: 3 }],
    community: [
      { key: "c1", label: "CEITEC", count: 3 },
      { key: "c2", label: "BioExcel", count: 1 },
    ],
    structure: [],
    engine: [{ key: "GROMACS", label: "GROMACS", count: 4 }],
    author: [],
    funder: [],
    keyword: [],
  },
};

const setup = (search = "") =>
  renderWithProviders(
    <ListNavigationProvider query={parseListQuery(new URLSearchParams(search))}>
      <FiltersColumn facets={facets} total={4} />
      <ControlsRow />
      <ActiveFilterChips facets={facets} />
    </ListNavigationProvider>,
  );

const lastUrl = () => (nav.push.mock.calls.at(-1) ?? nav.replace.mock.calls.at(-1))?.[0] as string;

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
});

describe("My depositions controls", () => {
  it("puts a ticked facet in the URL", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: /CEITEC/ }));
    expect(lastUrl()).toBe("/depositions?community=c1");
  });

  it("disables zero-count access options and lists all three", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: /Restricted/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Open/ })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /Embargoed/ })).toBeDisabled();
  });

  it("shows active chips, removes one and clears all", async () => {
    setup("community=c1&engine=GROMACS");
    const chips = screen.getByRole("group", { name: "Active filters" });
    expect(within(chips).getByText("CEITEC")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove filter Community: CEITEC" }));
    expect(lastUrl()).toBe("/depositions?engine=GROMACS");
    await userEvent.click(within(chips).getByRole("button", { name: "Clear all" }));
    expect(lastUrl()).toBe("/depositions");
  });

  it("switches the status tab and keeps filters", async () => {
    setup("community=c1");
    await userEvent.click(screen.getByRole("tab", { name: "Draft" }));
    expect(lastUrl()).toBe("/depositions?status=draft&community=c1");
  });

  it("debounces search into the URL", async () => {
    setup();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search depositions" }), "lys");
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/depositions?q=lys", { scroll: false }));
  });

  it("applies a date range typed as a year on blur", async () => {
    setup();
    const from = screen.getByRole("textbox", { name: "Created from" });
    await userEvent.type(from, "2025");
    await userEvent.tab();
    expect(lastUrl()).toBe("/depositions?from=2025-01-01");
  });

  it("marks an invalid date and does not navigate", async () => {
    setup();
    const from = screen.getByRole("textbox", { name: "Created from" });
    await userEvent.type(from, "nope");
    await userEvent.tab();
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(nav.push).not.toHaveBeenCalled();
  });
});
