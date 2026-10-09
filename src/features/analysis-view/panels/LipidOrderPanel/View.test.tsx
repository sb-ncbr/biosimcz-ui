import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { lipidOrderSchema } from "@/entities/analysis";
import { renderWithProviders } from "@/test/renderWithProviders";
import { parseSynthetic } from "../testing/membraneFixtures";

vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  return {
    ...actual,
    LineChart: (p: { series: { band?: unknown }[] }) => <div data-testid="line" data-band={String(Boolean(p.series[0]?.band))} />,
  };
});

const { default: LipidOrderPanel } = await import("./View");

const context = { instanceId: "MD-A1.1", analysisName: "lipid-order", frameStepNs: null, atoms: null };

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("LipidOrderPanel (fixture-only synthetic data)", () => {
  it("draws the std band and lists atom labels", () => {
    renderWithProviders(<LipidOrderPanel data={parseSynthetic(lipidOrderSchema, "lipid-order")} context={context} />);
    expect(screen.getByTestId("line")).toHaveAttribute("data-band", "true");
    expect(screen.getByText("1. C2")).toBeInTheDocument();
  });

  it("keeps both selects mounted after picking a lipid without segments", async () => {
    renderWithProviders(<LipidOrderPanel data={parseSynthetic(lipidOrderSchema, "lipid-order")} context={context} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Lipid" }));
    await userEvent.click(await screen.findByRole("option", { name: "CHOL" }));
    expect(screen.getByText("The selected lipid does not contain usable segment data.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lipid" })).toHaveTextContent("CHOL");
    expect(screen.getByRole("combobox", { name: "Segment" })).toBeInTheDocument();
  });

  it("keeps the selects without any lipid", () => {
    renderWithProviders(<LipidOrderPanel data={{ data: {} }} context={context} />);
    expect(screen.getByText("No lipid order data available.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lipid" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Segment" })).toBeInTheDocument();
  });
});
