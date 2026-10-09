import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RecordDetail } from "@/entities/record";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RecordDetailView } from "./RecordDetailView";

// Mol* needs WebGL; the page only has to mount it on demand with the right URL.
vi.mock("@/shared/viewers/molstar", () => ({
  StructureViewer: ({ structureUrl }: { structureUrl: string }) => <div data-testid="structure-viewer" data-url={structureUrl} />,
  structureUrlFor: (id: string) => `/bff/records/${id}/structure`,
}));

const record: RecordDetail = {
  id: "pub-popc",
  title: "POPC membrane with cholesterol",
  authors: [{ name: "Jana Novakova", orcid: "0000-0002-1825-0097", affiliations: ["Masaryk University"] }],
  description: "A membrane simulation.",
  publishedAt: "2026-02-12T09:00:00Z",
  doi: "10.1234/mdrepo.4821",
  version: 2,
  access: "open",
  embargoUntil: null,
  license: "cc-by-4.0",
  communities: [{ id: "c1", label: "BioSim CZ" }],
  keywords: ["membrane", "lipid bilayer"],
  accession: null,
  engine: "GROMACS",
  waterModel: null,
  method: null,
  replicaCount: null,
  groups: [],
  simulation: null,
  licenseUrl: null,
  citation: null,
  acknowledgements: null,
  links: [],
  pdbIds: [],
  uniprotIds: [],
  contact: null,
  sequences: [],
  replicaNames: [],
  updatedAt: null,
  totalSize: null,
  files: [
    { key: "topol.top", size: 20_480, mimetype: "text/plain" },
    { key: "traj.xtc", size: 52_428_800, mimetype: null },
  ],
};

const project: RecordDetail = {
  ...record,
  id: "MD-A00005",
  accession: "MD-A00005",
  doi: null,
  version: null,
  access: null,
  communities: [],
  keywords: [],
  engine: "GROMACS 2024.1",
  groups: ["Masaryk University, Membrane Lab"],
  license: "This trajectory dataset is released under a Creative Commons Attribution 4.0 International Public License",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  citation: "DOI: 10.0000/example.2026",
  acknowledgements: "Computing time granted by CERIT-SC.",
  links: [{ label: "Paper", url: "https://example.org/paper" }],
  pdbIds: ["1AKI"],
  uniprotIds: ["P00698"],
  contact: "For questions write to data@example.org",
  sequences: [{ kind: "protein", sequence: "A".repeat(320) }],
  replicaNames: ["replica 1", "replica 2"],
  updatedAt: "2026-06-26T15:18:12Z",
  totalSize: 384_909_122,
  simulation: { method: "Classical MD", type: "trajectory", ensemble: "NPT", forceFields: ["CHARMM36m"], waterModel: "TIP3P", temperature: 310, timestep: 2, lengthNs: 1000, atoms: 52000, frames: 100000, replicas: 2 },
  files: Array.from({ length: 12 }, (_, index) => ({ key: `file-${index + 1}.pdb`, size: null, mimetype: null })),
};

const section = (name: string) => screen.getByRole("region", { name });

describe("RecordDetailView for an MDRepo record", () => {
  it("shows the header, byline and the facts panel", () => {
    renderWithProviders(<RecordDetailView record={record} />);
    expect(screen.getByRole("heading", { level: 1, name: "POPC membrane with cholesterol" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByText("Published", { selector: ":not(dt)" })).toBeInTheDocument();
    expect(screen.getByText("A membrane simulation.")).toBeInTheDocument();
    const facts = screen.getByRole("complementary", { name: "Record" });
    expect(within(facts).getByRole("link", { name: "10.1234/mdrepo.4821" })).toHaveAttribute("href", "https://doi.org/10.1234/mdrepo.4821");
    expect(within(facts).getByText("12 Feb 2026")).toBeInTheDocument();
    expect(within(facts).getByText("v2")).toBeInTheDocument();
    expect(within(facts).queryByTestId("record-thumbnail")).not.toBeInTheDocument();
  });

  it("lists authors with ORCID, communities, license and keywords", () => {
    renderWithProviders(<RecordDetailView record={record} />);
    const contributors = section("Contributors");
    expect(within(contributors).getByRole("link", { name: "ORCID of Jana Novakova" })).toHaveAttribute("href", "https://orcid.org/0000-0002-1825-0097");
    expect(within(contributors).getByText("BioSim CZ")).toBeInTheDocument();
    expect(within(section("License")).getByText("CC BY 4.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "lipid bilayer" })).toHaveAttribute("href", "/records?keyword=lipid+bilayer");
  });

  it("lists the files with type and size", () => {
    renderWithProviders(<RecordDetailView record={record} />);
    const table = within(section("Files")).getByRole("table");
    expect(within(table).getByText("topol.top")).toBeInTheDocument();
    expect(within(table).getByText("XTC")).toBeInTheDocument();
    expect(within(table).getByText("20 KB")).toBeInTheDocument();
    expect(within(table).getByText("50 MB")).toBeInTheDocument();
  });

  it("explains a missing file list by access", () => {
    const { unmount } = renderWithProviders(<RecordDetailView record={{ ...record, files: null, access: "restricted" }} />);
    expect(screen.getByText("Files are restricted.")).toBeInTheDocument();
    unmount();
    renderWithProviders(<RecordDetailView record={{ ...record, files: null, access: "embargoed", embargoUntil: "2027-03-01" }} />);
    expect(screen.getByText("Files are available after 1 Mar 2027.")).toBeInTheDocument();
  });

  it("renders an invalid DOI as plain text, not a link", () => {
    renderWithProviders(<RecordDetailView record={{ ...record, doi: "javascript:alert(1)" }} />);
    expect(screen.getAllByText("javascript:alert(1)").length).toBeGreaterThan(0);
    expect(document.querySelector('a[href*="javascript"]')).toBeNull();
  });

  it("hides every section without data", () => {
    renderWithProviders(
      <RecordDetailView
        record={{ ...record, title: null, authors: [], description: null, doi: null, keywords: [], communities: [], files: [], engine: null, version: null, license: null }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Untitled record" })).toBeInTheDocument();
    for (const name of ["Simulation details", "Contributors", "Sequences", "MD trajectories", "Files", "References", "License", "Keywords", "Acknowledgements"]) {
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Not provided")).not.toBeInTheDocument();
  });
});

describe("RecordDetailView for an MDposit project", () => {
  it("shows the accession and data type badges and the simulation facts", () => {
    renderWithProviders(<RecordDetailView record={project} />);
    expect(screen.getAllByText("MD-A00005").length).toBeGreaterThan(0);
    expect(screen.getByText("Trajectory")).toBeInTheDocument();
    const simulation = section("Simulation details");
    for (const fact of ["GROMACS 2024.1", "Classical MD", "NPT", "CHARMM36m", "TIP3P", "310 K", "2 fs", "1,000 ns", "52,000", "100,000"]) {
      expect(within(simulation).getByText(fact)).toBeInTheDocument();
    }
  });

  it("shows created and updated dates, the total size and no MDRepo-only rows", () => {
    renderWithProviders(<RecordDetailView record={project} />);
    const facts = screen.getByRole("complementary", { name: "Record" });
    expect(within(facts).getByText("Created")).toBeInTheDocument();
    expect(within(facts).getByText("26 Jun 2026")).toBeInTheDocument();
    expect(within(facts).getByText("367 MB")).toBeInTheDocument();
    for (const term of ["DOI", "Version", "Access"]) expect(within(facts).queryByText(term, { selector: "dt" })).not.toBeInTheDocument();
  });

  it("offers a button above the structure that opens the first replica's experiment details", () => {
    renderWithProviders(<RecordDetailView record={project} />);
    const facts = screen.getByRole("complementary", { name: "Record" });
    const button = within(facts).getByRole("link", { name: "Open experiment details" });
    expect(button).toHaveAttribute("href", "/records/MD-A00005/experiments/replica%201/overview");
    expect(button.compareDocumentPosition(screen.getByTestId("record-thumbnail")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has no experiment button for a record without replicas", () => {
    renderWithProviders(<RecordDetailView record={record} />);
    expect(screen.queryByRole("link", { name: "Open experiment details" })).not.toBeInTheDocument();
  });

  it("shows the poster and mounts the 3D viewer only on request", async () => {
    renderWithProviders(<RecordDetailView record={project} />);
    expect(screen.getByTestId("record-thumbnail")).toBeInTheDocument();
    expect(screen.queryByTestId("structure-viewer")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View 3D structure" }));
    expect(screen.getByTestId("structure-viewer")).toHaveAttribute("data-url", "/bff/records/MD-A00005/structure");
  });

  it("shows groups as chips and the contact address as a mailto link", () => {
    renderWithProviders(<RecordDetailView record={project} />);
    const contributors = section("Contributors");
    expect(within(contributors).getByText("Masaryk University, Membrane Lab")).toBeInTheDocument();
    expect(within(contributors).getByRole("link", { name: "data@example.org" })).toHaveAttribute("href", "mailto:data@example.org");
  });

  it("links references to their databases, with safe external links", () => {
    renderWithProviders(<RecordDetailView record={project} />);
    const references = section("References");
    expect(within(references).getByText("DOI: 10.0000/example.2026")).toBeInTheDocument();
    expect(within(references).getByRole("link", { name: "1AKI" })).toHaveAttribute("href", "https://www.rcsb.org/structure/1AKI");
    expect(within(references).getByRole("link", { name: "P00698" })).toHaveAttribute("href", "https://www.uniprot.org/uniprotkb/P00698");
    const paper = within(references).getByRole("link", { name: "Paper" });
    expect(paper).toHaveAttribute("href", "https://example.org/paper");
    expect(paper).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(section("License")).getByRole("link", { name: "View the license text" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  });

  it("shows a long sequence clamped with its residue count, expandable and copyable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<RecordDetailView record={project} />);
    const sequences = section("Sequences");
    expect(within(sequences).getByText(/Protein · 320 residues/)).toBeInTheDocument();
    const toggle = within(sequences).getByRole("button", { name: "Show all 320 residues" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(within(sequences).getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(within(sequences).getByRole("button", { name: "Copy sequence 1" }));
    expect(writeText).toHaveBeenCalledWith("A".repeat(320));
    expect(await within(sequences).findByRole("button", { name: "sequence 1 copied" })).toBeInTheDocument();
  });

  it("lists the replicas and collapses the file table past ten rows", async () => {
    renderWithProviders(<RecordDetailView record={project} />);
    const trajectories = section("MD trajectories");
    expect(within(trajectories).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["1replica 1", "2replica 2"]);
    expect(within(trajectories).getByRole("link", { name: "replica 1" })).toHaveAttribute("href", "/records/MD-A00005/experiments/replica%201");
    expect(within(trajectories).getByRole("link", { name: "replica 2" })).toHaveAttribute("href", "/records/MD-A00005/experiments/replica%202");
    expect(within(trajectories).getByRole("link", { name: "Explore experiments" })).toHaveAttribute(
      "href",
      "/records/MD-A00005/experiments/replica%201/overview",
    );
    const files = section("Files");
    expect(within(files).getAllByRole("row")).toHaveLength(11);
    expect(within(files).queryByText("Size")).not.toBeInTheDocument();
    await userEvent.click(within(files).getByRole("button", { name: "Show all 12 files" }));
    expect(within(files).getAllByRole("row")).toHaveLength(13);
    expect(within(files).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the acknowledgements", () => {
    renderWithProviders(<RecordDetailView record={project} />);
    expect(within(section("Acknowledgements")).getByText("Computing time granted by CERIT-SC.")).toBeInTheDocument();
  });
});
