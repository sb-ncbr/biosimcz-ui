import type { Quantity } from "../model/types";

// Rounding hides binary float noise (25031 * 0.1 = 2503.1000000000004) without losing real precision.
const clean = (value: number): number => Number(value.toPrecision(12));

// FRAMESTEP is in nanoseconds.
const frequencyPs = (frameStepNs: Quantity): Quantity => (frameStepNs === null ? null : clean(frameStepNs * 1000));

const simulationLengthNs = (frames: Quantity, frameStepNs: Quantity): Quantity =>
  frames === null || frameStepNs === null ? null : clean(frames * frameStepNs);

const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

// Zero renders "0"; missing renders null so the caller picks its own placeholder.
const formatQuantity = (value: Quantity, unit?: string): string | null => {
  if (value === null || !Number.isFinite(value)) return null;
  const text = formatter.format(value);
  return unit ? `${text} ${unit}` : text;
};

export { formatQuantity, frequencyPs, simulationLengthNs };
