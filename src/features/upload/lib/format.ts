const UNITS = ["B", "KB", "MB", "GB"] as const;
const BASE = 1024;

// Binary steps so the 52_428_800 byte limit reads "50 MB", as in the design copy.
const scale = (bytes: number): { value: number; unit: (typeof UNITS)[number] } => {
  let value = bytes;
  let unit = 0;
  while (value >= BASE && unit < UNITS.length - 1) {
    value /= BASE;
    unit++;
  }
  return { value, unit: UNITS[unit] ?? "B" };
};

const number = (value: number, unit: string): string => {
  if (unit === "B" || value >= 100) return Math.round(value).toString();
  return value.toFixed(1).replace(/\.0$/, "");
};

const formatBytes = (bytes: number): string => {
  const { value, unit } = scale(bytes);
  return `${number(value, unit)} ${unit}`;
};

// "3.1 of 4.8 MB": both numbers share the total's unit so the pair reads as one quantity.
const formatProgress = (loaded: number, total: number): string => {
  const { unit } = scale(total);
  const divisor = BASE ** UNITS.indexOf(unit);
  const done = unit === "B" ? Math.round(loaded).toString() : (loaded / divisor).toFixed(1);
  return `${done} of ${formatBytes(total)}`;
};

export { formatBytes, formatProgress };
