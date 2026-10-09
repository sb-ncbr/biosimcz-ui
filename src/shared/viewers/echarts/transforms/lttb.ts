import type { XY } from "./types";

const lttb = (points: readonly XY[], threshold: number): XY[] => {
  const n = points.length;
  if (threshold >= n || threshold < 3) return points.slice();

  const first = points[0]!;
  const last = points[n - 1]!;
  const out: XY[] = [first];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const start = Math.floor((i + 1) * bucketSize) + 1;
    const end = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    let avgX = 0;
    let avgY = 0;
    for (let j = start; j < end; j++) {
      const [px, py] = points[j]!;
      avgX += px;
      avgY += py;
    }
    const len = end - start;
    avgX /= len;
    avgY /= len;

    const rangeStart = Math.floor(i * bucketSize) + 1;
    const [ax, ay] = points[a]!;
    let maxArea = -1;
    let chosen = rangeStart;
    for (let j = rangeStart; j < start; j++) {
      const [px, py] = points[j]!;
      const area = Math.abs((ax - avgX) * (py - ay) - (ax - px) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        chosen = j;
      }
    }
    out.push(points[chosen]!);
    a = chosen;
  }

  out.push(last);
  return out;
};

export { lttb };
