import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepositionListItem } from "@/entities/deposition";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DepositionCard } from "./DepositionCard";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const deleteDraft = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("../actions", () => ({ deleteDraft }));

const draft: DepositionListItem = {
  id: "d1",
  kind: "draft",
  title: "Lysozyme in water",
  authors: ["Novakova J."],
  structure: { source: "pdb", id: "1AKI" },
  access: "open",
  embargoUntil: null,
  license: "cc-by-4.0",
  description: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-29T00:00:00Z",
  publishedAt: null,
  doi: null,
  version: null,
  hasPreview: false,
  progress: {
    steps: [
      { id: "study", title: "Study details", status: "partial" },
      { id: "system", title: "Molecular system", status: "done" },
      { id: "experiments", title: "Experiments", status: "todo" },
    ],
    requiredLeft: 3,
    completion: 40,
    attentionStep: "study",
  },
};

const published: DepositionListItem = {
  ...draft,
  id: "p1",
  kind: "published",
  title: "POPC membrane",
  doi: "10.1234/mdrepo.4821",
  version: 2,
  description: "A long description of the simulation.",
  progress: null,
};

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  deleteDraft.mockReset();
});

describe("DepositionCard", () => {
  it("renders the draft variant with progress, required pill and footer", () => {
    renderWithProviders(<DepositionCard item={draft} timeLabel="Edited 2 h ago" />);
    expect(screen.getByRole("link", { name: "Lysozyme in water" })).toHaveAttribute("href", "/depositions/d1");
    expect(screen.getByText("3 required")).toBeInTheDocument();
    expect(screen.getByText("Molecular system")).toBeInTheDocument();
    expect(screen.getByText("PDB 1AKI")).toBeInTheDocument();
    expect(screen.getByText("CC BY 4.0")).toBeInTheDocument();
    expect(screen.getByText("Edited 2 h ago")).toBeInTheDocument();
  });

  it("shows fallbacks for an empty draft", () => {
    renderWithProviders(
      <DepositionCard item={{ ...draft, title: null, authors: [], structure: null, access: null, license: null }} timeLabel="Edited just now" />,
    );
    expect(screen.getByText("Unnamed deposition")).toBeInTheDocument();
    expect(screen.getByText("No authors yet")).toBeInTheDocument();
    expect(screen.getByText("No structure")).toBeInTheDocument();
    expect(screen.getByText("Access not set")).toBeInTheDocument();
    expect(screen.getByText("License not set")).toBeInTheDocument();
  });

  it("copies the DOI of a published card and toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<DepositionCard item={published} timeLabel="Published 12 Feb 2026" />);
    expect(screen.getByText("v2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy DOI 10.1234/mdrepo.4821" }));
    expect(writeText).toHaveBeenCalledWith("10.1234/mdrepo.4821");
    expect(toast.success).toHaveBeenCalledWith("DOI copied");
  });

  it("toasts an error when the clipboard is refused", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    renderWithProviders(<DepositionCard item={published} timeLabel="x" />);
    await userEvent.click(screen.getByRole("button", { name: /Copy DOI/ }));
    expect(toast.error).toHaveBeenCalled();
  });

  it("expands the description", async () => {
    renderWithProviders(<DepositionCard item={published} timeLabel="x" />);
    const toggle = screen.getByRole("button", { name: "Expand description" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Collapse description" })).toHaveAttribute("aria-expanded", "true");
  });

  it("confirms before deleting a draft and deletes on confirm", async () => {
    deleteDraft.mockResolvedValue({ ok: true, value: null });
    renderWithProviders(<DepositionCard item={draft} timeLabel="x" />);
    await userEvent.click(screen.getByRole("button", { name: "More actions for Lysozyme in water" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete draft" }));
    expect(await screen.findByText("Delete this draft?")).toBeInTheDocument();
    expect(deleteDraft).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(deleteDraft).toHaveBeenCalledWith("d1");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Draft deleted"));
  });

  it("keeps the dialog and toasts when deleting fails", async () => {
    deleteDraft.mockResolvedValue({ ok: false, error: { kind: "http", messageKey: "errors.http" } });
    renderWithProviders(<DepositionCard item={draft} timeLabel="x" />);
    await userEvent.click(screen.getByRole("button", { name: /More actions/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete draft" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not delete the draft. Try again."));
    expect(screen.getByText("Delete this draft?")).toBeInTheDocument();
  });
});
