// Evaluator for exactly the filter grammar the app's query builder emits:
//   filter    := { "$and": [filter, ...] } | { "<dotted.path>": condition, ... }
//   condition := { "$in": [...] } | { "$regex": string, "$options": "i" } | { "$gte": number }
// Anything else throws, so an adapter bug (a new operator, a stray key) surfaces as a 400 in tests and e2e instead of being
// silently ignored like a lenient mock would.

type Json = Record<string, unknown>;

class UnsupportedFilter extends Error {}

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

const valuesAt = (document: unknown, path: string): unknown[] => {
  let current: unknown[] = [document];
  for (const key of path.split(".")) {
    current = current.flatMap((item) => (isObject(item) && key in item ? (Array.isArray(item[key]) ? (item[key] as unknown[]) : [item[key]]) : []));
  }
  return current.filter((value) => value !== null && value !== undefined);
};

const condition = (values: unknown[], spec: unknown): boolean => {
  if (!isObject(spec)) throw new UnsupportedFilter("condition must be an object");
  const keys = Object.keys(spec).sort();
  if (keys.length === 1 && keys[0] === "$in" && Array.isArray(spec["$in"])) {
    const wanted = spec["$in"] as unknown[];
    return values.some((value) => wanted.includes(value));
  }
  if (keys.length === 1 && keys[0] === "$gte" && typeof spec["$gte"] === "number") {
    const min = spec["$gte"];
    return values.some((value) => typeof value === "number" && value >= min);
  }
  if (keys.join() === "$options,$regex" && typeof spec["$regex"] === "string" && spec["$options"] === "i") {
    const pattern = new RegExp(spec["$regex"], "i");
    return values.some((value) => typeof value === "string" && pattern.test(value));
  }
  throw new UnsupportedFilter(`unsupported condition ${keys.join(",")}`);
};

const matches = (document: unknown, filter: unknown): boolean => {
  if (!isObject(filter)) throw new UnsupportedFilter("filter must be an object");
  return Object.entries(filter).every(([key, spec]) => {
    if (key === "$and") {
      if (!Array.isArray(spec)) throw new UnsupportedFilter("$and needs an array");
      return spec.every((part) => matches(document, part));
    }
    if (key.startsWith("$")) throw new UnsupportedFilter(`unsupported operator ${key}`);
    return condition(valuesAt(document, key), spec);
  });
};

export { matches, UnsupportedFilter, valuesAt };
