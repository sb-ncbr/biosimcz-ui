import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountBadge } from "./CountBadge";
import { StatusPill } from "./StatusPill";

describe("CountBadge", () => {
  it("renders required, optional and plain counts", () => {
    render(
      <>
        <CountBadge count={2} />
        <CountBadge count={3} variant="optional" />
        <CountBadge count={5} variant="count" />
      </>,
    );
    expect(screen.getByText("2 required")).toBeInTheDocument();
    expect(screen.getByText("+ 3 optional")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders nothing when no required or optional fields are left", () => {
    const { container } = render(<CountBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StatusPill", () => {
  it("uses the default label per status and allows an override", () => {
    render(
      <>
        <StatusPill status="changes_requested" />
        <StatusPill status="embargoed">Embargoed until 1 Mar 2027</StatusPill>
      </>,
    );
    expect(screen.getByText("Changes requested")).toHaveAttribute("data-status", "changes_requested");
    expect(screen.getByText("Embargoed until 1 Mar 2027")).toBeInTheDocument();
  });
});
