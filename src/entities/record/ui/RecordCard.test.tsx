import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { RecordSummary } from "../model/types";
import { RecordCard } from "./RecordCard";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const record: RecordSummary = {
  id: "pub popc",
  title: "POPC membrane with cholesterol",
  authors: ["Novakova J.", "Kovar P.", "Dvorak T.", "Svoboda L."],
  description: "A membrane simulation.",
  publishedAt: "2026-02-12T09:00:00Z",
  doi: "10.1234/mdrepo.4821",
  version: 2,
  access: "embargoed",
  embargoUntil: "2027-03-01",
  license: "cc-by-4.0",
  communities: [{ id: "c1", label: "BioSim CZ" }],
  keywords: [],
  accession: null,
  engine: null,
  waterModel: null,
  method: null,
  replicaCount: null,
  groups: [],
};

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("RecordCard", () => {
  it("links the title to the encoded record URL and truncates the byline", () => {
    renderWithProviders(<RecordCard record={record} />);
    expect(screen.getByRole("heading", { level: 2, name: "POPC membrane with cholesterol" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "POPC membrane with cholesterol" })).toHaveAttribute("href", "/records/pub%20popc");
    expect(screen.getByText("Novakova J., Kovar P., Dvorak T., et al.")).toBeInTheDocument();
  });

  it("shows community, date, access with text and license", () => {
    renderWithProviders(<RecordCard record={record} />);
    expect(screen.getByText("BioSim CZ")).toBeInTheDocument();
    expect(screen.getByText("Published 12 Feb 2026")).toBeInTheDocument();
    expect(screen.getByText("Embargoed until 1 Mar 2027")).toBeInTheDocument();
    expect(screen.getByText("CC BY 4.0")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("copies the DOI from the chip", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<RecordCard record={record} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy DOI 10.1234/mdrepo.4821" }));
    expect(writeText).toHaveBeenCalledWith("10.1234/mdrepo.4821");
    expect(toast.success).toHaveBeenCalledWith("DOI copied");
  });

  it("renders a placeholder for a missing title, DOI, description and authors", () => {
    renderWithProviders(<RecordCard record={{ ...record, title: null, doi: null, description: null, authors: [], communities: [], access: null, license: null, version: null }} />);
    expect(screen.getByRole("link", { name: "Untitled record" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy DOI/ })).not.toBeInTheDocument();
    expect(screen.getByText("No description")).toBeInTheDocument();
    expect(screen.getByText("No authors listed")).toBeInTheDocument();
    expect(screen.queryByText(/Access/)).not.toBeInTheDocument();
  });

  it("shows the MDposit facts and no access, DOI or license", () => {
    renderWithProviders(
      <RecordCard
        record={{
          ...record,
          id: "MD-A00005",
          accession: "MD-A00005",
          doi: null,
          version: null,
          access: null,
          license: null,
          communities: [],
          engine: "GROMACS 2024.1",
          waterModel: "TIP3P",
          method: "Classical MD",
          replicaCount: 2,
          groups: ["Masaryk University, Membrane Lab", "Other"],
        }}
      />,
    );
    expect(screen.getByText("MD-A00005")).toBeInTheDocument();
    for (const fact of ["GROMACS 2024.1", "TIP3P", "Classical MD", "2 replicas", "Masaryk University, Membrane Lab"]) expect(screen.getByText(fact)).toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
    expect(screen.queryByText(/Access|Embargoed|CC BY/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy DOI/ })).not.toBeInTheDocument();
  });
});
