import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeDraft } from "@/test/depositionFixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PublishedView } from "./PublishedView";

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/features/deposition-create", () => ({ NewDepositionButton: () => <button type="button">Start a new deposition</button> }));

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe("PublishedView", () => {
  it("confirms the publication, shows DOI, access and license, and takes focus on the heading", () => {
    renderWithProviders(<PublishedView study={completeDraft().study} doi="10.1234/mdrepo.d1" />);
    const heading = screen.getByRole("heading", { name: "Deposition published" });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Lysozyme in water is now public.")).toBeInTheDocument();
    expect(screen.getByText("10.1234/mdrepo.d1")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("CC BY 4.0")).toBeInTheDocument();
  });

  it("links to My depositions and offers a new deposition; View record waits for the record route", () => {
    renderWithProviders(<PublishedView study={completeDraft().study} doi={null} />);
    expect(screen.getByRole("link", { name: "Go to My depositions" })).toHaveAttribute("href", "/depositions");
    expect(screen.getByRole("button", { name: "Start a new deposition" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View record" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy DOI" })).not.toBeInTheDocument();
  });

  it("links to the record when its address is known", () => {
    renderWithProviders(<PublishedView study={completeDraft().study} doi={null} recordHref="/records/1" />);
    expect(screen.getByRole("link", { name: "View record" })).toHaveAttribute("href", "/records/1");
  });

  it("copies the DOI and says so", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<PublishedView study={completeDraft().study} doi="10.1234/mdrepo.d1" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy DOI" }));
    expect(writeText).toHaveBeenCalledWith("10.1234/mdrepo.d1");
    expect(toast.success).toHaveBeenCalledWith("DOI copied");
  });
});
