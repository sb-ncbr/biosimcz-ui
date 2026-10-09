const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

// Binary steps like the upload list ("50 MB" for 52_428_800), so the sizes of one record read the same everywhere.
const formatFileSize = (bytes: number): string => {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const text = unit === 0 || value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${UNITS[unit]}`;
};

export { formatFileSize };
