type XY = readonly [number, number];

type SeriesForCsv = { name: string; data: readonly XY[] };

type Stats = { mean: number; std: number; min: number; max: number; count: number };

// Ranges are inclusive source indices; strides are source cells per bin on each axis.
type BinnedMatrix = {
  rows: number;
  cols: number;
  values: Float64Array;
  rowRanges: readonly [number, number][];
  colRanges: readonly [number, number][];
  rowStride: number;
  colStride: number;
};

export type { BinnedMatrix, SeriesForCsv, Stats, XY };
