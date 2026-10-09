import { emptyRun, newRunId, SIMULATION_TYPE_LABELS, type Run, type SimulationType } from "@/entities/deposition";

const lengthUnit = (type: SimulationType | undefined): "steps" | "ns" => (type === "energy_minimization" ? "steps" : "ns");

const isDynamic = (run: Run): boolean => run.simulationType !== undefined && run.simulationType !== "energy_minimization";
const hasTemperature = (run: Run): boolean => isDynamic(run) && (run.ensemble === "NVT" || run.ensemble === "NpT");
const hasPressure = (run: Run): boolean => isDynamic(run) && run.ensemble === "NpT";

const taken = (runs: readonly Run[], name: string): boolean => runs.some((run) => run.name?.trim().toLowerCase() === name.toLowerCase());

// "Molecular dynamics", then "Molecular dynamics 2", ... so the duplicate-name rule never fires on a fresh run.
const uniqueName = (runs: readonly Run[], base: string): string => {
  if (!taken(runs, base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken(runs, candidate)) return candidate;
  }
};

const createRun = (type: SimulationType, runs: readonly Run[], id: string = newRunId()): Run => ({
  ...emptyRun(id),
  name: uniqueName(runs, SIMULATION_TYPE_LABELS[type]),
  simulationType: type,
});

// Files stay with the original run: they live on the server under their own keys.
const duplicateRun = (source: Run, runs: readonly Run[], id: string = newRunId()): Run => {
  const copy: Run = JSON.parse(JSON.stringify(source)) as Run;
  return { ...copy, id, fileKeys: [], name: uniqueName(runs, `${source.name?.trim() || "Unnamed run"} (copy)`) };
};

// Inserts the copy right below its source (missing-states 5.3).
const insertAfter = (runs: readonly Run[], sourceId: string, copy: Run): Run[] => {
  const index = runs.findIndex((run) => run.id === sourceId);
  return index < 0 ? [...runs, copy] : [...runs.slice(0, index + 1), copy, ...runs.slice(index + 1)];
};

const moveRun = (runs: readonly Run[], id: string, delta: -1 | 1): Run[] => {
  const from = runs.findIndex((run) => run.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= runs.length) return [...runs];
  const next = [...runs];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
};

const formatNumber = (value: number): string => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);

type Cell = { kind: "value"; text: string } | { kind: "missing" } | { kind: "na" };

const valueCell = (value: number | undefined, unit: string): Cell =>
  value === undefined || !Number.isFinite(value) ? { kind: "missing" } : { kind: "value", text: `${formatNumber(value)} ${unit}` };

type RunSummary = {
  typeLabel: string | null;
  ensemble: string | null;
  length: Cell;
  temperature: Cell;
  pressure: Cell;
};

// What a table row shows (186:1099): values that do not apply to the run type are "na", required ones still empty "missing".
const summarizeRun = (run: Run): RunSummary => ({
  typeLabel: run.simulationType ? SIMULATION_TYPE_LABELS[run.simulationType] : null,
  ensemble: isDynamic(run) ? (run.ensemble ?? null) : null,
  length: run.simulationType ? valueCell(run.length, lengthUnit(run.simulationType)) : { kind: "na" },
  temperature: hasTemperature(run) ? valueCell(run.temperature?.referenceK, "K") : { kind: "na" },
  pressure: hasPressure(run) ? valueCell(run.pressure?.referenceBar, "bar") : { kind: "na" },
});

const cellText = (cell: Cell): string => (cell.kind === "value" ? cell.text : cell.kind === "missing" ? "missing" : "-");

// Sections that stop applying when the type or ensemble changes but still hold values (missing-states 5.4).
const hasValues = (section: object | undefined): boolean =>
  section !== undefined && Object.values(section).some((value) => value !== undefined && value !== "");

const hiddenWithValues = (run: Run): string[] => {
  const hidden: string[] = [];
  if (!hasTemperature(run) && hasValues(run.temperature)) hidden.push("Temperature");
  if (!hasPressure(run) && hasValues(run.pressure)) hidden.push("Pressure");
  return hidden;
};

const countFiles = (run: Run): number => run.fileKeys.length;

export {
  cellText,
  countFiles,
  createRun,
  duplicateRun,
  hasPressure,
  hasTemperature,
  hiddenWithValues,
  insertAfter,
  isDynamic,
  lengthUnit,
  moveRun,
  summarizeRun,
  uniqueName,
};
export type { Cell, RunSummary };
