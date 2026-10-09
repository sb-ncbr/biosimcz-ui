import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, iconNames } from "./Icon";

describe("Icon", () => {
  it("is hidden from assistive tech without a label", () => {
    const { container } = render(<Icon name="grip" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes a label as an image role", () => {
    render(<Icon name="status-done-16" label="Complete" />);
    expect(screen.getByRole("img", { name: "Complete" })).toBeInTheDocument();
  });

  it("renders illustrative tiles as images with their own colours", () => {
    render(<Icon name="mol-protein-22" label="Protein" />);
    expect(screen.getByRole("img", { name: "Protein" }).tagName).toBe("IMG");
  });

  it("renders every exported icon", () => {
    for (const name of iconNames) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector(`[data-icon="${name}"]`)).not.toBeNull();
      unmount();
    }
  });
});
