// A loop, not Math.min(...values): spreading hundreds of thousands of values overflows the call stack.
const minMax = (values: ArrayLike<number>): { min: number; max: number } | null => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min > max ? null : { min, max };
};

export { minMax };
