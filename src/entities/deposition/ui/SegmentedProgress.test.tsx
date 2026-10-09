import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SegmentedProgress } from "./SegmentedProgress";

const segments = [
  { id: "study", label: "Study details", value: 1, tooltip: "11 of 11 required fields - 100%" },
  { id: "system", label: "Molecular system", value: 0.625 },
  { id: "runs", label: "Experiments", value: 2 },
];

describe("SegmentedProgress", () => {
  it("exposes one progressbar per segment with clamped values", () => {
    renderWithProviders(<SegmentedProgress segments={segments} aria-label="Deposition progress" />);
    expect(screen.getByRole("group", { name: "Deposition progress" })).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
    expect(screen.getByRole("progressbar", { name: "Molecular system" })).toHaveAttribute("aria-valuenow", "63");
    expect(screen.getByRole("progressbar", { name: "Experiments" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows the tooltip when a segment gets keyboard focus", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SegmentedProgress segments={segments} aria-label="Deposition progress" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("11 of 11 required fields - 100%");
  });
});
