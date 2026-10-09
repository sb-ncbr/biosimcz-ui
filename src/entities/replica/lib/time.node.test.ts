import { describe, expect, it } from "vitest";
import { formatQuantity, frequencyPs, simulationLengthNs } from "./time";
import { estimateTrajectoryBytes } from "./trajectorySize";

describe("time helpers", () => {
  it("computes length and frequency without float artefacts", () => {
    expect(simulationLengthNs(25031, 0.1)).toBe(2503.1);
    expect(frequencyPs(0.1)).toBe(100);
    expect(formatQuantity(simulationLengthNs(25031, 0.1), "ns")).toBe("2,503.1 ns");
    expect(formatQuantity(frequencyPs(0.1), "ps")).toBe("100 ps");
  });

  it("renders zero as 0 and missing as null", () => {
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(null)).toBeNull();
    expect(simulationLengthNs(null, 0.1)).toBeNull();
    expect(frequencyPs(null)).toBeNull();
  });

  it("rounds to two fraction digits", () => {
    expect(formatQuantity(1.23456)).toBe("1.23");
  });
});

describe("estimateTrajectoryBytes", () => {
  it("uses all frames when no range is given", () => {
    expect(estimateTrajectoryBytes(undefined, 100, 10)).toBe(100 * 10 * 12);
  });

  it("applies range and stride, clamped to the total", () => {
    expect(estimateTrajectoryBytes("1:1000:10", 100, 25)).toBe(3 * 100 * 12);
  });

  it("returns null when sizes are unknown", () => {
    expect(estimateTrajectoryBytes(undefined, null, 10)).toBeNull();
  });
});
