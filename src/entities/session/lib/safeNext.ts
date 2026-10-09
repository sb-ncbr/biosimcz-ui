const FALLBACK = "/";

// Accepts only same-origin relative paths starting with a single "/"; anything else becomes the fallback.
const safeNext = (next: string | string[] | null | undefined, fallback: string = FALLBACK): string => {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Backslashes and control characters are normalised to "/" or dropped by browsers, which re-opens "//host".
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://safe-next.invalid");
    if (parsed.origin !== "http://safe-next.invalid") return fallback;
  } catch {
    return fallback;
  }
  return value;
};

export { safeNext };
