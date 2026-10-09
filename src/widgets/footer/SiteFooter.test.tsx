import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("renders a contentinfo landmark with the helpdesk hint", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Need help? e-INFRA CZ helpdesk");
  });
});
