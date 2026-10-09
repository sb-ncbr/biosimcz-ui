import type { AxisSpec } from "../types";
import { axisTitle } from "./tooltip";

type Option = Record<string, unknown>;

const ANIMATION_LIMIT = 10_000;

// containLabel ignores axis names, and a middle-placed name sits nameGap left of the axis line: without this reserve it is clipped by the canvas edge when tick labels are narrow.
const Y_NAME_RESERVE = 36;
// The last x tick label is centred on the grid edge and overhangs it by half its width.
const X_END_RESERVE = 28;
// Same reason as Y_NAME_RESERVE for the x name below the tick labels.
const X_NAME_RESERVE = 24;

// containLabel keeps rotated names and tick labels inside the canvas; the y name sits in the middle so it never meets the legend.
const grid = (extra: { top?: number; bottom?: number; right?: number } = {}): Option => ({
  containLabel: true,
  left: Y_NAME_RESERVE,
  right: extra.right ?? X_END_RESERVE,
  top: extra.top ?? 16,
  bottom: extra.bottom ?? X_NAME_RESERVE,
});

const valueAxis = (axis: AxisSpec, position: "left" | "right" = "left"): Option => ({
  type: "value",
  name: axisTitle(axis),
  nameLocation: "middle",
  nameGap: 44,
  nameRotate: position === "left" ? 90 : -90,
  position,
  min: axis.min,
  max: axis.max,
  scale: axis.scale,
  splitLine: { show: position === "left" },
});

const xValueAxis = (axis: AxisSpec): Option => ({
  type: "value",
  name: axisTitle(axis),
  nameLocation: "middle",
  nameGap: 28,
  min: axis.min,
  max: axis.max,
  scale: axis.scale,
});

const animationFor = (pointCount: number): Option => ({ animation: pointCount <= ANIMATION_LIMIT });

export type { Option };
export { animationFor, grid, valueAxis, xValueAxis };
