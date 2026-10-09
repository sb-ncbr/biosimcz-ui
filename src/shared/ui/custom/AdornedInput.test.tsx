import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AdornedInput } from "./AdornedInput";

describe("AdornedInput", () => {
  it("links the unit adornments to the input as its description", () => {
    render(<AdornedInput aria-label="Edge X" startAdornment="X" endAdornment="nm" defaultValue="6.82" />);
    const input = screen.getByRole("textbox", { name: "Edge X" });
    expect(input).toHaveAccessibleDescription("X nm");
    expect(input).toHaveValue("6.82");
  });

  it("keeps an existing description and renders the trailing control", async () => {
    const user = userEvent.setup();
    let clicks = 0;
    render(
      <>
        <p id="hint">Edge lengths of the box.</p>
        <AdornedInput
          aria-label="DOI"
          aria-describedby="hint"
          endAdornment="ns"
          trailing={
            <button type="button" onClick={() => clicks++}>
              Generate DOI
            </button>
          }
        />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "DOI" })).toHaveAccessibleDescription("Edge lengths of the box. ns");
    await user.click(screen.getByRole("button", { name: "Generate DOI" }));
    expect(clicks).toBe(1);
  });
});
