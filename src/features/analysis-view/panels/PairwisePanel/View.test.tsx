import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// The shared double drops `actions` and `badge`, which this panel relies on for its select and badges.
vi.mock("@/shared/viewers/echarts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/viewers/echarts")>();
  const { matrixChartsMock } = await import("../testing/matrixChartsMock");
  return {
    ...matrixChartsMock,
    PanelIntro: actual.PanelIntro,
    ChartFrame: (p: {
      title: string;
      description?: string;
      badge?: ReactNode;
      actions?: ReactNode;
      summary: string;
      empty?: { reason: string } | null;
      children: ReactNode;
    }) => (
      <section aria-label={p.title}>
        {p.description ? <p>{p.description}</p> : null}
        {p.badge ? <span>{p.badge}</span> : null}
        {p.actions}
        <p data-testid="summary">{p.summary}</p>
        {p.empty ? <p role="status">{p.empty.reason}</p> : p.children}
      </section>
    ),
  };
});

import PairwisePanel from "./View";

const context = {
  instanceId: "MD-A1.1",
  analysisName: "rmsd-pairwise",
  frameStepNs: null,
  atoms: null,
};
const data = {
  start: 0,
  step: 10,
  matrices: [
    {
      name: "Overall",
      values: [
        [0, 1],
        [1, 0],
      ],
    },
    {
      name: "Ligand",
      values: [
        [0, 2],
        [2, 0],
      ],
    },
  ],
};

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe("PairwisePanel", () => {
  it("keeps the select mounted while switching matrices", async () => {
    render(<PairwisePanel context={context} data={data} config={{ variant: "global" }} />);
    expect(screen.getByTestId("heatmap")).toHaveAttribute("data-title", "RMSD pairwise · Overall");
    await userEvent.click(screen.getByRole("combobox", { name: "Interaction" }));
    await userEvent.click(await screen.findByRole("option", { name: "Ligand" }));
    expect(screen.getByRole("combobox", { name: "Interaction" })).toHaveTextContent("Ligand");
    expect(screen.getByTestId("heatmap")).toHaveAttribute("data-title", "RMSD pairwise · Ligand");
  });

  it("uses the interface wording, tiles and badges for the interface variant", () => {
    render(
      <PairwisePanel context={{ ...context, analysisName: "rmsd-pairwise-interface" }} data={data} config={{ variant: "interface" }} />,
    );
    expect(screen.getByText("Interface pairwise RMSD")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Pairwise deviation heatmap" })).toBeInTheDocument();
    expect(screen.getByText("Active interface")).toBeInTheDocument();
    expect(screen.getByText("Matrix resolution")).toBeInTheDocument();
    expect(screen.getByText("Raw 2 × 2")).toBeInTheDocument();
    expect(screen.getByText("Full resolution")).toBeInTheDocument();
  });

  it("shows the old empty message for an interface without matrices", () => {
    render(<PairwisePanel context={context} data={{ start: 0, step: 1, matrices: [] }} config={{ variant: "interface" }} />);
    expect(screen.getByText("No interface RMSD matrices available.")).toBeInTheDocument();
  });

  it("shows the empty reason for the global variant without matrices", () => {
    render(<PairwisePanel context={context} data={{ start: 0, step: 1, matrices: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("No pairwise matrix in this analysis");
  });
});
