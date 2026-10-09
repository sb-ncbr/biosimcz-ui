import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FacetHistogram } from "./FacetHistogram";

const bars = [
  { key: "2024", label: "24", value: 4 },
  { key: "2025", label: "25", value: 10, selected: true },
  { key: "2026", label: "26", value: 0 },
];

describe("FacetHistogram", () => {
  it("describes each bar for assistive tech when read-only", () => {
    render(<FacetHistogram bars={bars} aria-label="Depositions by year" />);
    expect(screen.getByRole("group", { name: "Depositions by year" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "25: 10" })).toBeInTheDocument();
  });

  it("makes bars toggle buttons when a click handler is given", async () => {
    const user = userEvent.setup();
    const onBarClick = vi.fn();
    render(<FacetHistogram bars={bars} aria-label="Depositions by year" onBarClick={onBarClick} />);
    expect(screen.getByRole("button", { name: "25: 10" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "24: 4" }));
    expect(onBarClick).toHaveBeenCalledWith("2024");
  });

  it("scales bar heights against the largest bucket", () => {
    render(<FacetHistogram bars={bars} aria-label="Depositions by year" />);
    const heights = screen.getAllByRole("img").map((el) => (el.firstElementChild as HTMLElement).style.height);
    expect(heights).toEqual(["40%", "100%", "0%"]);
  });
});
