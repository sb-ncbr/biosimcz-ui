import { fieldAnchor, systemSchema, type System } from "@/entities/deposition";
import { getAt, isBlank, setAt, stableKey } from "@/shared/lib";

// Prefill from parsed files (plan 4.4, missing-states 5.2): empty fields are filled and marked with their source file;
// a field the user already has a different value for is kept, and only replaced after an explicit confirmation.

type ParsedField = { path: string; value: unknown };

type PrefillGroup = {
  // Pill label in the callouts.
  label: string;
  // "Go to field" target; absent for values that have no input (water model).
  anchor?: string;
};

// Relative path (inside `system`) -> the field the user sees.
const GROUP_OF: Record<string, PrefillGroup> = {
  "engine.name": {
    label: "Engine",
    anchor: fieldAnchor("engine", "engine.name"),
  },
  "engine.version": {
    label: "Version",
    anchor: fieldAnchor("engine", "engine.version"),
  },
  "engine.build": {
    label: "Build",
    anchor: fieldAnchor("engine", "engine.build"),
  },
  forceField: {
    label: "Force field",
    anchor: fieldAnchor("composition", "forceField"),
  },
  waterModel: { label: "Water model" },
  startingStructure: {
    label: "Starting structure",
    anchor: fieldAnchor("composition", "startingStructure"),
  },
  molecules: {
    label: "Molecules",
    anchor: fieldAnchor("composition", "molecules"),
  },
  systemSize: {
    label: "System size",
    anchor: fieldAnchor("dimensions", "systemSize"),
  },
  "box.shape": {
    label: "Box shape",
    anchor: fieldAnchor("dimensions", "box.shape"),
  },
  "box.a": {
    label: "Box vectors",
    anchor: fieldAnchor("dimensions", "box.vectors"),
  },
  "box.b": {
    label: "Box vectors",
    anchor: fieldAnchor("dimensions", "box.vectors"),
  },
  "box.c": {
    label: "Box vectors",
    anchor: fieldAnchor("dimensions", "box.vectors"),
  },
  "box.alpha": {
    label: "Box angles",
    anchor: fieldAnchor("dimensions", "box.angles"),
  },
  "box.beta": {
    label: "Box angles",
    anchor: fieldAnchor("dimensions", "box.angles"),
  },
  "box.gamma": {
    label: "Box angles",
    anchor: fieldAnchor("dimensions", "box.angles"),
  },
};

type PrefillChange = {
  path: string;
  value: unknown;
  current?: unknown;
} & PrefillGroup;

type PrefillPlan = {
  file: string;
  fill: PrefillChange[];
  // Different value already present: needs the user's confirmation to be replaced.
  keep: PrefillChange[];
};

const isEmptyAt = (system: System, path: string): boolean => {
  if (path === "startingStructure") {
    return isBlank(getAt(system, "startingStructure.id")) && getAt(system, "startingStructure.source") !== "custom";
  }
  return isBlank(getAt(system, path));
};

const isAcceptable = (path: string, value: unknown): boolean => systemSchema.safeParse(setAt({}, path, value)).success;

const planPrefill = (system: System, file: string, fields: readonly ParsedField[]): PrefillPlan => {
  const plan: PrefillPlan = { file, fill: [], keep: [] };
  const seen = new Set<string>();
  for (const field of fields) {
    const path = field.path.startsWith("system.") ? field.path.slice("system.".length) : null;
    const group = path ? GROUP_OF[path] : undefined;
    if (!path || !group || seen.has(path) || isBlank(field.value) || !isAcceptable(path, field.value)) continue;
    seen.add(path);
    const current = getAt(system, path);
    if (isEmptyAt(system, path)) plan.fill.push({ path, value: field.value, ...group });
    else if (stableKey(current) !== stableKey(field.value)) plan.keep.push({ path, value: field.value, current, ...group });
  }
  return plan;
};

// Writes the changes and records the file as the source of each path.
const applyChanges = (system: System, file: string, changes: readonly PrefillChange[]): System => {
  let next = system;
  const sources = { ...system.fieldSources };
  for (const change of changes) {
    next = setAt(next, change.path, change.value);
    sources[change.path] = file;
  }
  return { ...next, fieldSources: sources };
};

const uniqueLabels = (changes: readonly PrefillChange[]): PrefillGroup[] => {
  const seen = new Map<string, PrefillGroup>();
  for (const change of changes) {
    if (!seen.has(change.label))
      seen.set(change.label, {
        label: change.label,
        ...(change.anchor && { anchor: change.anchor }),
      });
  }
  return [...seen.values()];
};

// Source file for a field: the first recorded path at or under one of the given paths.
const sourceOf = (system: System, paths: readonly string[]): string | undefined => {
  for (const [path, file] of Object.entries(system.fieldSources)) {
    if (paths.some((candidate) => path === candidate || path.startsWith(`${candidate}.`))) return file;
  }
  return undefined;
};

const OWNED_KEYS = ["engine", "forceField", "startingStructure", "molecules", "systemSize", "box"];

// Keeps only the provenance whose value is still what the file gave (an edited field loses its chip).
const dropEditedSources = (before: System, after: Record<string, unknown>): Record<string, string> => {
  const kept: Record<string, string> = {};
  for (const [path, file] of Object.entries(before.fieldSources)) {
    const editable = OWNED_KEYS.includes(path.split(".")[0] ?? "");
    if (!editable || stableKey(getAt(before, path)) === stableKey(getAt(after, path))) kept[path] = file;
  }
  return kept;
};

export { applyChanges, dropEditedSources, GROUP_OF, planPrefill, sourceOf, uniqueLabels };
export type { ParsedField, PrefillChange, PrefillGroup, PrefillPlan };
