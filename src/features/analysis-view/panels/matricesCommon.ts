import { minMax, type BinnedMatrix, type Stats } from "@/shared/viewers/echarts";
import { formatValue } from "./timeSeriesCommon";

const MATRIX_HEIGHT = 480;

// Statistics are taken from the raw matrix, never from the binned cells, so the strip stays honest about the data.
const matrixStats = (rows: readonly ArrayLike<number>[]): Stats | null => {
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      const v = row[c]!;
      if (!Number.isFinite(v)) continue;
      count++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (count === 0) return null;
  const mean = sum / count;
  let sq = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      const v = row[c]!;
      if (Number.isFinite(v)) sq += (v - mean) ** 2;
    }
  }
  return { mean, std: Math.sqrt(sq / count), min, max, count };
};

const matrixWidth = (rows: readonly ArrayLike<number>[]): number => (rows.length > 0 ? rows[0]!.length : 0);

const isBinned = (matrix: BinnedMatrix): boolean => matrix.rowStride > 1 || matrix.colStride > 1;

// Tells the reader how the drawn cells relate to the raw values behind the statistics.
const binningNote = (matrix: BinnedMatrix, rawRows: number, rawCols: number): string => {
  if (!isBinned(matrix)) return `Every one of the ${rawRows} x ${rawCols} raw values is drawn.`;
  const range = minMax(matrix.values);
  const drawn = range ? ` The colour range ${formatValue(range.min)} to ${formatValue(range.max)} covers cell means only.` : "";
  return `Drawn as ${matrix.rows} x ${matrix.cols} cells, each the mean of up to ${matrix.rowStride} x ${matrix.colStride} of the ${rawRows} x ${rawCols} raw values.${drawn} The statistics use the raw values.`;
};

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

export { MATRIX_HEIGHT, binningNote, matrixStats, matrixWidth, percent };
