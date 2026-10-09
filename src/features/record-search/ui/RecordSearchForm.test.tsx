import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RecordSearchForm } from "./RecordSearchForm";

describe("RecordSearchForm", () => {
  it("is a search landmark: a GET form to / with a labelled q field", () => {
    renderWithProviders(<RecordSearchForm />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/records");
    expect(form).toHaveAttribute("method", "get");
    const input = screen.getByRole("searchbox", { name: "Search records" });
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("maxlength", "200");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("prefills the current query", () => {
    renderWithProviders(<RecordSearchForm defaultValue="lysozyme" />);
    expect(
      screen.getByRole("searchbox", { name: "Search records" }),
    ).toHaveValue("lysozyme");
  });

  it("keeps the compact variant labelled and submittable", () => {
    renderWithProviders(<RecordSearchForm size="compact" />);
    expect(
      screen.getByRole("searchbox", { name: "Search records" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
