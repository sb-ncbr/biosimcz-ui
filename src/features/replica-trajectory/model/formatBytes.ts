const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

// Decimal units to match the 250 MB warning threshold shown to the user.
const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
};

export { formatBytes };
