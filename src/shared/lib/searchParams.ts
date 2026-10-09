// Tolerant URL parsing helpers shared by the list pages (my depositions, public records): a hand-edited or stale URL
// must never throw, it just falls back to defaults.

type RawParams = Record<string, string | string[] | undefined>;

type FacetLimits = { maxValues: number; maxChars: number };

const asList = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const first = (value: string | string[] | undefined): string | undefined => asList(value)[0];

const oneOf = <T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T =>
  allowed.find((candidate) => candidate === value) ?? fallback;

const readFacetValues = (raw: string[], limits: FacetLimits): string[] => {
  const cleaned = raw.map((value) => value.trim()).filter((value) => value !== "" && value.length <= limits.maxChars);
  return [...new Set(cleaned)].slice(0, limits.maxValues);
};

const toRaw = (input: RawParams | URLSearchParams): RawParams => {
  if (!(input instanceof URLSearchParams)) return input;
  const raw: RawParams = {};
  for (const key of new Set(input.keys())) raw[key] = input.getAll(key);
  return raw;
};

export { asList, first, oneOf, readFacetValues, toRaw };
export type { FacetLimits, RawParams };
