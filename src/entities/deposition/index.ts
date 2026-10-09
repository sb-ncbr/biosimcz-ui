// Client-safe surface of the deposition entity: pure schemas, registry and completeness. Presentational components stay
// under ./ui so a server-side import of the model never pulls React in.
export { draftHref, isDraftId, isRunId, newRunId } from "./lib/draftId";
export type { WizardTarget } from "./lib/draftId";
export { computeCompleteness, firstIncompleteStep } from "./model/completeness";
export type { Completeness, CompletionStatus, Counts, FieldRef, RunResult, SectionResult, StepResult } from "./model/completeness";
export { emptyDraft, emptyRun, sanitizeDraft } from "./model/draft";
export {
  ACCESS_VALUES,
  BOX_SHAPES,
  BOX_SHAPES_WITH_ANGLES,
  CREATOR_KINDS,
  ENSEMBLES,
  MOLECULE_TYPES,
  SIMULATION_TYPES,
  SIMULATION_TYPE_LABELS,
  STRUCTURE_SOURCES,
} from "./model/enums";
export type { AccessValue, BoxShape, CreatorKind, Ensemble, MoleculeType, SimulationType, StructureSource } from "./model/enums";
export { draftSchema, isValidIsoDate, isValidOrcid, runSchema, studySchema, systemSchema } from "./model/schema.draft";
export { publishSchema, toFieldErrors } from "./model/schema.publish";
export { fieldAnchor, ghostSections, RUN_SECTIONS, STEPS, STUDY_SECTIONS, SYSTEM_SECTIONS } from "./model/sections";
export type { FieldSpec, SectionSpec, StepId, StepSpec } from "./model/sections";
export type { Creator, DepositionDraft, DraftFileInfo, DraftSnapshot, Molecule, Run, Study, System } from "./model/types";
export { DATE_GRANULARITIES, FACET_NAMES, LIST_PAGE_SIZE, LIST_SORTS, LIST_STATUSES } from "./model/listing";
export type {
  DateBucket,
  DateGranularity,
  DepositionFacets,
  DepositionList,
  DepositionListItem,
  DepositionListQuery,
  DraftProgress,
  FacetName,
  FacetOption,
  ListSort,
  ListStatus,
  ProgressStep,
} from "./model/listing";
export { ACCESS_LABELS, accessLabel, formatDay, licenseLabel } from "./lib/labels";
