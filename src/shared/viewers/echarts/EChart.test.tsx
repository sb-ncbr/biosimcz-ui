import { render } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartHandle } from "./EChart";

const instance = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  clear: vi.fn(),
  dispatchAction: vi.fn(),
  getDataURL: vi.fn(() => "data:image/png;base64,AAAA"),
}));
const init = vi.hoisted(() => vi.fn());
const registerTheme = vi.hoisted(() => vi.fn());

vi.mock("./core", () => ({ init, registerTheme }));

import { EChart } from "./EChart";

let resizeCallback: () => void = () => {};
const disconnect = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  init.mockReturnValue(instance);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});

describe("EChart", () => {
  it("creates one canvas instance and merges later options with the zoom-preserving flags", () => {
    const { rerender } = render(<EChart option={{ series: [] }} height={200} ariaLabel="chart" />);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0]?.[2]).toEqual({ renderer: "canvas" });
    expect(registerTheme).toHaveBeenCalledTimes(1);

    const next = { series: [{ type: "line", data: [1] }] };
    rerender(<EChart option={next} height={200} ariaLabel="chart" />);
    expect(init).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenLastCalledWith(next, { notMerge: false, lazyUpdate: true, replaceMerge: ["series"] });
  });

  it("resizes on container resize and disposes on unmount", () => {
    const { unmount } = render(<EChart option={{}} height={200} ariaLabel="chart" />);
    resizeCallback();
    expect(instance.resize).toHaveBeenCalled();
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });

  it("exposes toPng and resetZoom through the ref", () => {
    const ref = createRef<ChartHandle>();
    render(<EChart option={{}} height={200} ariaLabel="chart" ref={ref} />);
    expect(ref.current?.toPng()).toBe("data:image/png;base64,AAAA");
    expect(instance.getDataURL).toHaveBeenCalledWith(expect.objectContaining({ type: "png" }));
    ref.current?.resetZoom();
    expect(instance.dispatchAction).toHaveBeenCalledWith({ type: "dataZoom", start: 0, end: 100 });
  });
});
