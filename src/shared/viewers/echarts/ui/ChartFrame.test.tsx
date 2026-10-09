import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartHandle } from "../EChart";

const download = vi.hoisted(() => ({ saveBlob: vi.fn(), saveDataUrl: vi.fn() }));

vi.mock("@/shared/lib", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/shared/lib")>()), ...download }));

import { ChartFrame } from "./ChartFrame";

const handle = (): ChartHandle => ({ toPng: vi.fn(() => "data:image/png;base64,AAAA"), resetZoom: vi.fn() });

beforeEach(() => vi.clearAllMocks());

describe("ChartFrame", () => {
  it("shows the summary and routes PNG, CSV and reset zoom through the handle", () => {
    const chart = createRef<ChartHandle | null>() as { current: ChartHandle | null };
    chart.current = handle();
    render(
      <ChartFrame title="RMSD" summary="Mean 1.2 nm" filename="my replica/rmsd" height={200} chart={chart} csv={() => "a,b"}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getByText("Mean 1.2 nm")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /png/i }));
    expect(download.saveDataUrl).toHaveBeenCalledWith("data:image/png;base64,AAAA", "my_replica_rmsd.png");

    fireEvent.click(screen.getByRole("button", { name: /csv/i }));
    expect(download.saveBlob).toHaveBeenCalledTimes(1);
    expect(download.saveBlob.mock.calls[0]?.[1]).toBe("my_replica_rmsd.csv");

    fireEvent.click(screen.getByRole("button", { name: /reset zoom/i }));
    expect(chart.current.resetZoom).toHaveBeenCalled();
  });

  it("shows the empty reason instead of the chart and disables exports", () => {
    const chart = { current: handle() };
    render(
      <ChartFrame title="RMSD" summary="No data" filename="x" height={200} chart={chart} csv={() => ""} empty={{ reason: "No data for this reference" }}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getByText("No data for this reference")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /png/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /csv/i })).toBeDisabled();
  });
});
