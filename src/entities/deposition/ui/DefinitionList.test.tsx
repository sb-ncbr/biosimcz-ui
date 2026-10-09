import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DefinitionList } from "./DefinitionList";

describe("DefinitionList", () => {
  it("renders terms with one or many values", () => {
    render(
      <DefinitionList
        items={[
          { term: "Title", description: "Lysozyme in water" },
          { term: "Keywords", description: ["lysozyme", "protein dynamics"] },
        ]}
      />,
    );
    expect(screen.getByText("Title").tagName).toBe("DT");
    expect(screen.getByText("protein dynamics").closest("dd")).toContainElement(screen.getByText("lysozyme"));
  });

  it("marks a missing value with fallback text", () => {
    render(<DefinitionList items={[{ term: "Experiment files" }, { term: "DOI", missingText: "Not generated yet" }]} />);
    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.getByText("Not generated yet")).toBeInTheDocument();
  });
});
