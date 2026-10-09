import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrajectoryRequest } from "./useTrajectoryRequest";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), query: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/records/MD-A.1/experiments/replica_1/trajectory",
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const PATH = "/records/MD-A.1/experiments/replica_1/trajectory";

describe("useTrajectoryRequest", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.query = "";
  });
  afterEach(() => vi.restoreAllMocks());

  it("prefills from the URL and never navigates or fetches on mount", () => {
    navigation.query = "frames=1%3A1000%3A10&selection=protein";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useTrajectoryRequest());
    expect(result.current.request).toEqual({ frames: "1:1000:10", selection: "protein" });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("starts empty without params", () => {
    const { result } = renderHook(() => useTrajectoryRequest());
    expect(result.current.request).toEqual({ frames: "", selection: "" });
  });

  it("writes only non-empty values to the URL on commit", () => {
    const { result } = renderHook(() => useTrajectoryRequest());
    act(() => result.current.commit({ frames: "1:50", selection: "" }));
    expect(navigation.replace).toHaveBeenCalledWith(`${PATH}?frames=1%3A50`, { scroll: false });
    expect(result.current.request).toEqual({ frames: "1:50", selection: "" });
    act(() => result.current.commit({ frames: "", selection: "" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(PATH, { scroll: false });
  });
});
