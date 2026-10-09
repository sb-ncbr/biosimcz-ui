import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MDPOSIT_CAPABILITIES,
  MDREPO_CAPABILITIES,
  type RecordSearchResult,
  type RecordSourceCapabilities,
} from "@/entities/record";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseRecordQuery } from "../model/urlState";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { RecordControls } from "./RecordControls";
import { RecordFiltersColumn } from "./RecordFilters";
import { RecordNavigationProvider } from "./RecordNavigation";
import { RecordResultsRegion } from "./RecordResultsClient";
import { NoMatches, NoRecords, RecordsError } from "./RecordStates";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  usePathname: () => "/records",
}));

const mdposit: RecordSearchResult["facets"] = {
  software: [
    { key: "GROMACS", label: "GROMACS", count: 4 },
    { key: "Amber", label: "Amber", count: 2 },
  ],
  force_field: [{ key: "CHARMM36m", label: "CHARMM36m", count: 3 }],
  temp: [{ key: "300", label: "300", count: 3 }],
};

const mdrepo: RecordSearchResult["facets"] = {
  access: [{ key: "open", label: "open", count: 3 }],
  community: [{ key: "c1", label: "BioSim CZ", count: 2 }],
  software: [{ key: "GROMACS", label: "GROMACS", count: 4 }],
  keyword: [{ key: "membrane", label: "membrane", count: 2 }],
};

const setup = (
  search = "",
  capabilities: RecordSourceCapabilities = MDPOSIT_CAPABILITIES,
  facets = mdposit,
  facetsAvailable = true,
) =>
  renderWithProviders(
    <RecordNavigationProvider
      query={parseRecordQuery(new URLSearchParams(search), capabilities)}
    >
      <RecordFiltersColumn
        capabilities={capabilities}
        facets={facets}
        facetsAvailable={facetsAvailable}
      />
      <RecordControls total={4} capabilities={capabilities} />
      <ActiveFilterChips capabilities={capabilities} />
    </RecordNavigationProvider>,
  );

const lastUrl = () =>
  (nav.push.mock.calls.at(-1) ?? nav.replace.mock.calls.at(-1))?.[0] as string;

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
});

describe("RecordFilters (MDposit capabilities)", () => {
  it("renders exactly the declared facets and no unsupported ones", () => {
    setup();
    const column = screen.getByRole("complementary", { name: "Filters" });
    for (const title of [
      "Engine",
      "Force field",
      "Water model",
      "Method",
      "Data type",
      "Collection",
      "Ensemble",
      "Temperature (K)",
      "Timestep (fs)",
      "Author",
      "Group",
      "Min. atoms",
    ]) {
      expect(column).toHaveTextContent(title);
    }
    for (const missing of [
      "Access",
      "License",
      "Tags",
      "Parametrization",
      "Thermostat",
      "Barostat",
      "Constraints",
      "Pressure",
      "Community",
    ]) {
      expect(column).not.toHaveTextContent(missing);
    }
  });

  it("puts a ticked facet in the URL and resets the page", async () => {
    setup("?q=lipid&page=3");
    await userEvent.click(screen.getByRole("checkbox", { name: /GROMACS/ }));
    expect(lastUrl()).toBe("/records?q=lipid&software=GROMACS");
  });

  it("shows counts, and hides them when they are null", () => {
    const { unmount } = setup();
    expect(
      screen.getByRole("checkbox", { name: /GROMACS/ }).closest("label"),
    ).toHaveTextContent("4");
    unmount();
    setup("", MDPOSIT_CAPABILITIES, {
      software: [{ key: "GROMACS", label: "GROMACS", count: null }],
    });
    expect(
      screen.getByRole("checkbox", { name: /GROMACS/ }).closest("label"),
    ).not.toHaveTextContent(/\d/);
  });

  it("keeps a selected value that is no longer listed visible so it can be unchecked", async () => {
    setup("?software=AMBER");
    const box = screen.getByRole("checkbox", { name: /AMBER/ });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(lastUrl()).toBe("/records");
  });

  it("adds a text facet value on Enter and resets the page", async () => {
    setup("?page=2");
    await userEvent.type(
      screen.getByRole("combobox", { name: "Author" }),
      "Orozco{Enter}",
    );
    expect(lastUrl()).toBe("/records?creator=Orozco");
  });

  it("applies the minimum atom count with the Apply button", async () => {
    setup("?page=2");
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Min. atoms" }),
      "5000",
    );
    expect(nav.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(lastUrl()).toBe("/records?min_atoms=5000");
  });

  it("says so when the options could not be loaded", () => {
    setup("", MDPOSIT_CAPABILITIES, {}, false);
    expect(
      screen.getByText("Filter options are unavailable right now."),
    ).toBeInTheDocument();
  });

  it("clears the filters but keeps the search", async () => {
    setup("?q=lipid&software=GROMACS");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear all" })[0] as HTMLElement,
    );
    expect(lastUrl()).toBe("/records?q=lipid");
  });
});

describe("RecordFilters (MDRepo capabilities)", () => {
  it("renders the four MDRepo facets and lists all three access values, even with a zero count", () => {
    setup("", MDREPO_CAPABILITIES, mdrepo);
    for (const title of ["Access", "Community", "Engine", "Keywords"])
      expect(
        screen.getByRole("complementary", { name: "Filters" }),
      ).toHaveTextContent(title);
    expect(screen.getByRole("checkbox", { name: /Restricted/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Open/ })).toBeEnabled();
    expect(
      screen.queryByRole("checkbox", { name: /CHARMM/ }),
    ).not.toBeInTheDocument();
  });
});

describe("ActiveFilterChips", () => {
  it("shows one removable chip per selected value of a declared facet only", async () => {
    setup(
      "?software=GROMACS&software=Amber&creator=Orozco&access=open&thermostat_algo=x",
    );
    expect(screen.getByText("Engine: GROMACS")).toBeInTheDocument();
    expect(screen.getByText("Author: Orozco")).toBeInTheDocument();
    expect(screen.queryByText(/open/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thermostat/i)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove filter Engine: GROMACS" }),
    );
    expect(lastUrl()).toBe("/records?software=Amber&creator=Orozco");
  });

  it("clears all filters but keeps q, sort and size", async () => {
    setup("?q=lipid&sort=newest&size=50&software=GROMACS&page=2");
    const chips = screen.getByRole("list", { name: "Active filters" });
    await userEvent.click(
      chips.querySelector("button:not([aria-label])") as HTMLElement,
    );
    expect(lastUrl()).toBe("/records?q=lipid&sort=newest&size=50");
  });

  it("renders nothing without filters", () => {
    setup("?q=x");
    expect(
      screen.queryByRole("list", { name: "Active filters" }),
    ).not.toBeInTheDocument();
  });
});

describe("RecordControls", () => {
  it("shows the count and the sort and page size from the capabilities", () => {
    setup("?sort=title&size=10");
    expect(screen.getByText("4 simulations")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveTextContent(
      "Title A-Z",
    );
    expect(
      screen.getByRole("combobox", { name: "Per page" }),
    ).toHaveTextContent("10");
  });

  it("hides a Select with a single choice", () => {
    setup("", { ...MDPOSIT_CAPABILITIES, sorts: ["bestmatch"], sizes: [20] });
    expect(
      screen.queryByRole("combobox", { name: "Sort by" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Per page" }),
    ).not.toBeInTheDocument();
  });
});

describe("record states", () => {
  it("announces the count in a status region", () => {
    renderWithProviders(
      <RecordNavigationProvider
        query={parseRecordQuery({}, MDPOSIT_CAPABILITIES)}
      >
        <RecordResultsRegion total={1}>cards</RecordResultsRegion>
      </RecordNavigationProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 simulation");
  });

  it("offers links to clear the search and the filters when nothing matches", () => {
    renderWithProviders(
      <NoMatches
        query={parseRecordQuery(
          { q: "zzz", software: "GROMACS", sort: "title" },
          MDPOSIT_CAPABILITIES,
        )}
        capabilities={MDPOSIT_CAPABILITIES}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No records match" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/records?q=zzz&sort=title",
    );
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/records?sort=title&software=GROMACS",
    );
    expect(screen.getByText("Engine: GROMACS")).toBeInTheDocument();
  });

  it("shows the empty repository message", () => {
    renderWithProviders(<NoRecords />);
    expect(
      screen.getByRole("heading", { name: "No simulations yet" }),
    ).toBeInTheDocument();
  });

  it("retries from the error state and shows the code under Details", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<RecordsError digest="abc123" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not load records.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Error code: abc123")).toBeInTheDocument();
  });
});
