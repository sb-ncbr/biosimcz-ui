import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AnalysisPicker } from "./AnalysisPicker";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ANALYSES = ["rgyr", "clusters-00", "clusters-01", "pca"];

// Radix Select needs these jsdom gaps filled.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});
beforeEach(() => push.mockClear());

describe("AnalysisPicker", () => {
  it("hides the variant select for a group without variants", () => {
    renderWithProviders(<AnalysisPicker accession="MD-A1" replicaName="replica 1" analyses={ANALYSES} current="rgyr" />);
    expect(screen.getByRole("combobox", { name: "Analysis type" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Variant" })).not.toBeInTheDocument();
  });

  it("labels variants from the options list and falls back to labelOf", async () => {
    renderWithProviders(
      <AnalysisPicker
        accession="MD-A1"
        replicaName="replica 1"
        analyses={ANALYSES}
        current="clusters-00"
        options={[{ name: "Overall", analysis: "clusters-00" }]}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Variant" })).toHaveTextContent("Overall");
    await userEvent.click(screen.getByRole("combobox", { name: "Variant" }));
    expect(await screen.findByRole("option", { name: "Clusters - 01" })).toBeInTheDocument();
  });

  it("navigates to the encoded analysis route on change", async () => {
    renderWithProviders(<AnalysisPicker accession="MD-A1" replicaName="replica 1" analyses={ANALYSES} current="rgyr" />);
    await userEvent.click(screen.getByRole("combobox", { name: "Analysis type" }));
    await userEvent.click(await screen.findByRole("option", { name: "PCA" }));
    expect(push).toHaveBeenCalledWith("/records/MD-A1/experiments/replica%201/analyses/pca");
  });
});
