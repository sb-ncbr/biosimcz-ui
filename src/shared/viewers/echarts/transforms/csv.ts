import type { BinnedMatrix, SeriesForCsv } from "./types";

const cell = (value: string): string => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

const num = (v: number | undefined): string => (v === undefined || Number.isNaN(v) ? "" : String(v));

const line = (fields: readonly string[]): string => fields.map(cell).join(",");

const seriesToCsv = (series: readonly SeriesForCsv[], xHeader: string): string => {
  const rows = new Map<number, (number | undefined)[]>();
  series.forEach((s, i) => {
    for (const [x, y] of s.data) {
      let row = rows.get(x);
      if (!row) {
        row = new Array<number | undefined>(series.length).fill(undefined);
        rows.set(x, row);
      }
      row[i] = y;
    }
  });

  const out = [line([xHeader, ...series.map((s) => s.name)])];
  for (const [x, row] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    out.push(line([String(x), ...row.map(num)]));
  }
  return out.join("\n");
};

const matrixToCsv = (matrix: BinnedMatrix, rowLabels: readonly string[], colLabels: readonly string[]): string => {
  const out = [line(["", ...colLabels])];
  for (let r = 0; r < matrix.rows; r++) {
    const fields = [rowLabels[r] ?? String(r)];
    for (let c = 0; c < matrix.cols; c++) fields.push(num(matrix.values[r * matrix.cols + c]));
    out.push(line(fields));
  }
  return out.join("\n");
};

export { matrixToCsv, seriesToCsv };
