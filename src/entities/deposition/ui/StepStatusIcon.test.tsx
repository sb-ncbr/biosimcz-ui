import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepStatusIcon } from "./StepStatusIcon";

describe("StepStatusIcon", () => {
  it.each([
    ["done", "Complete"],
    ["partial", "In progress"],
    ["todo", "Not started"],
    ["error", "Needs attention"],
  ] as const)("%s has the text alternative %s", (status, name) => {
    render(<StepStatusIcon status={status} />);
    expect(screen.getByRole("img", { name })).toHaveAttribute("data-status", status);
  });

  it("accepts a custom label and the 16 px size", () => {
    render(<StepStatusIcon status="done" size={16} label="Study details complete" />);
    const icon = screen.getByRole("img", { name: "Study details complete" });
    expect(icon).toHaveAttribute("data-icon", "status-done-16");
  });
});
