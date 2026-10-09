// Plain helpers for form values that the wizard steps share. No domain types here.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isBlank = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return !Number.isFinite(value);
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.values(value).every(isBlank);
  return false;
};

const getAt = (scope: unknown, path: string): unknown => {
  let current: unknown = scope;
  for (const key of path.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
};

const setAt = <T extends Record<string, unknown>>(scope: T, path: string, value: unknown): T => {
  const [head, ...rest] = path.split(".");
  if (head === undefined) return scope;
  if (rest.length === 0) return { ...scope, [head]: value };
  const child = scope[head];
  return {
    ...scope,
    [head]: setAt(isRecord(child) ? child : {}, rest.join("."), value),
  };
};

// Key-order independent and blind to NaN and undefined, so "typed then cleared" and "never typed" compare equal.
const stableKey = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => {
    if (item === null || (typeof item === "number" && !Number.isFinite(item))) return undefined;
    if (isRecord(item)) return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    return item;
  }) ?? "";

// Form values to draft values: NaN (text that is not a number yet) and null (emptied number) are not values.
const cleanNumbers = <T>(value: T): T => JSON.parse(stableKey(value) || "null") as T;

// Emptied number inputs hold null; the schema wants them absent. NaN stays so that junk text is still reported.
const nullsToUndefined = (value: unknown): unknown => {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(nullsToUndefined);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, nullsToUndefined(item)]));
  return value;
};

// A saved value that is no longer in an option list stays selectable instead of silently disappearing.
const withCurrent = (options: readonly string[], current: string | undefined): string[] =>
  current && !options.includes(current) ? [current, ...options] : [...options];

export { cleanNumbers, getAt, isBlank, isRecord, nullsToUndefined, setAt, stableKey, withCurrent };
