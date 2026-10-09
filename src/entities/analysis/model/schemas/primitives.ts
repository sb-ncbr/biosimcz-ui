import { z } from "zod";

// Raw matrices above this size per side would freeze the tab; binned heatmaps stay far below it.
const MAX_MATRIX_SIDE = 4096;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// Plain loops instead of z.array(z.number()): payloads reach 2.3M values and per-element Zod parsing is too slow.
const isNumberArray = (value: unknown): value is number[] => {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (!isFiniteNumber(value[i])) return false;
  return true;
};

const isNullableNumberArray = (value: unknown): value is (number | null)[] => {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (value[i] !== null && !isFiniteNumber(value[i])) return false;
  return true;
};

const isFlag = (value: unknown): boolean => typeof value === "boolean" || value === 0 || value === 1;

const isFlagArray = (value: unknown): value is (boolean | 0 | 1)[] => {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) if (!isFlag(value[i])) return false;
  return true;
};

const isRectangular = (rows: unknown[], check: (row: unknown) => boolean, maxSide: number | null): boolean => {
  if (maxSide !== null && rows.length > maxSide) return false;
  const width = Array.isArray(rows[0]) ? rows[0].length : 0;
  if (maxSide !== null && width > maxSide) return false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!check(row) || (row as unknown[]).length !== width) return false;
  }
  return true;
};

const numberArray = z.custom<number[]>(isNumberArray, "Expected an array of finite numbers");
const nullableNumberArray = z.custom<(number | null)[]>(isNullableNumberArray, "Expected an array of numbers or nulls");

// Rows may differ in length (per-component or per-residue series).
const numberTable = z.custom<number[][]>(
  (value) => Array.isArray(value) && value.every(isNumberArray),
  "Expected an array of number arrays",
);
const nullableNumberTable = z.custom<(number | null)[][]>(
  (value) => Array.isArray(value) && value.every(isNullableNumberArray),
  "Expected an array of number or null arrays",
);

const numberMatrix = z.custom<number[][]>(
  (value) => Array.isArray(value) && isRectangular(value, isNumberArray, MAX_MATRIX_SIDE),
  `Expected a rectangular numeric matrix of at most ${MAX_MATRIX_SIDE} per side`,
);
const nullableNumberMatrix = z.custom<(number | null)[][]>(
  (value) => Array.isArray(value) && isRectangular(value, isNullableNumberArray, MAX_MATRIX_SIDE),
  `Expected a rectangular numeric matrix of at most ${MAX_MATRIX_SIDE} per side`,
);
// hbonds are [bond][frame]: the frame side may legitimately exceed MAX_MATRIX_SIDE.
const booleanMatrix = z.custom<(boolean | 0 | 1)[][]>(
  (value) => Array.isArray(value) && isRectangular(value, isFlagArray, null),
  "Expected a rectangular matrix of booleans or 0/1",
);

const statisticalData = z.object({
  average: z.number().optional(),
  stddev: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  data: numberArray,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Legacy payloads were a bare entry or an array of entries; the current ones wrap them in { data }.
const wrapAsData =
  (entryKeys: readonly string[]) =>
  (raw: unknown): unknown => {
    if (Array.isArray(raw)) return { data: raw };
    if (isObject(raw) && !Array.isArray(raw.data) && entryKeys.some((key) => key in raw)) return { data: [raw] };
    return raw;
  };

const fallbackName = (name: string | undefined, index: number): string => {
  const trimmed = name?.trim();
  return trimmed ? trimmed : `Interaction ${index + 1}`;
};

export {
  MAX_MATRIX_SIDE,
  booleanMatrix,
  fallbackName,
  isObject,
  nullableNumberMatrix,
  wrapAsData,
  nullableNumberArray,
  nullableNumberTable,
  numberArray,
  numberMatrix,
  numberTable,
  statisticalData,
};
