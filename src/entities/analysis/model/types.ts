type AnalysisGroup = {
  baseId: string;
  label: string;
  // Every name of the group in input order: the bare base (when present) next to its numbered variants.
  variants: string[];
  hasVariants: boolean;
};

type AnalysisOption = { name: string; analysis: string };

type ParseIssue = { path: string; message: string };
type ParseResult<T> = { ok: true; data: T } | { ok: false; issue: ParseIssue };

type AxisKey = "x" | "y" | "value";
// Units are taken from the old UI, never confirmed by the backend (plan Q5, OQ6).
type UnitLabel = { text: string; confirmed: false };

type SeriesStats = { mean: number; std: number; min: number; max: number; count: number };

export type { AnalysisGroup, AnalysisOption, AxisKey, ParseResult, SeriesStats, UnitLabel };
