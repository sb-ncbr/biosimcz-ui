import type { Stats } from "./types";

const summarize = (values: ArrayLike<number>): Stats | null => {
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    count++;
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (count === 0) return null;

  const mean = sum / count;
  let sq = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (Number.isFinite(v)) sq += (v - mean) ** 2;
  }
  return { mean, std: Math.sqrt(sq / count), min, max, count };
};

export { summarize };
