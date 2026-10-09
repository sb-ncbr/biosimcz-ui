// Client-safe surface of the analysis entity: names, units, payload schemas and the BFF query.
export { analysisDataQuery } from "./api/queries";
export { analysisDataUrl } from "./lib/href";
export { ANALYSIS_BASES, baseOf, groupAnalyses, isAnalysisBase, isAnalysisName, labelOf } from "./model/names";
export type { AnalysisBase } from "./model/names";
export { analysisOptionsSchema } from "./model/options";
export { parseWith } from "./model/parse";
export * from "./model/schemas";
export type { AnalysisOption, AxisKey, ParseResult, UnitLabel } from "./model/types";
export { ANALYSIS_UNITS } from "./model/units";
