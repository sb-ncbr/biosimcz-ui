import { draftSchema, isValidIsoDate } from "./schema.draft";
import {
  fieldAnchor,
  isFieldFilled,
  isFieldRequired,
  RUN_SECTIONS,
  STEPS,
  STUDY_SECTIONS,
  SYSTEM_SECTIONS,
  type SectionSpec,
  type StepId,
} from "./sections";
import type { DepositionDraft, Run } from "./types";

// Pure and shared by the client (sidebar, accordion headers, review, publish button) and the server (publish
// re-validation, My depositions progress). An empty draft yields completion 0 and every step "todo" (U2).

type CompletionStatus = "done" | "partial" | "todo" | "error";

type Counts = {
  requiredLeft: number;
  requiredTotal: number;
  optionalLeft: number;
  optionalTotal: number;
  // Fields with a format problem (missing-states 3.3 "N to fix").
  toFix: number;
};

// A field the user still has to fill (kind "missing") or repair (kind "format"); drives the review list.
type FieldRef = {
  stepId: StepId;
  sectionId: string;
  runId?: string;
  // Relative to its scope (study, system or the run), as in the section registry.
  path: string;
  label: string;
  location: string;
  anchor: string;
  kind: "missing" | "format";
  // Format problems only: the code from the schema ("invalid_doi", "date_not_future", ...).
  code?: string;
};

type SectionResult = Counts & {
  id: string;
  title: string;
  status: CompletionStatus;
  filledAny: boolean;
  missing: FieldRef[];
  fixes: FieldRef[];
};

type RunResult = Counts & {
  id: string;
  name: string | null;
  status: CompletionStatus;
  sections: SectionResult[];
};

type StepResult = Counts & {
  id: StepId;
  title: string;
  status: CompletionStatus;
  sections: SectionResult[];
  runs: RunResult[];
};

type Completeness = {
  steps: StepResult[];
  requiredLeft: number;
  requiredTotal: number;
  optionalLeft: number;
  toFix: number;
  // 0-100, share of required fields filled.
  completion: number;
  ready: boolean;
  missing: FieldRef[];
  fixes: FieldRef[];
};

type Issue = { path: readonly PropertyKey[]; code: string };

const ZERO: Counts = { requiredLeft: 0, requiredTotal: 0, optionalLeft: 0, optionalTotal: 0, toFix: 0 };

const addCounts = (a: Counts, b: Counts): Counts => ({
  requiredLeft: a.requiredLeft + b.requiredLeft,
  requiredTotal: a.requiredTotal + b.requiredTotal,
  optionalLeft: a.optionalLeft + b.optionalLeft,
  optionalTotal: a.optionalTotal + b.optionalTotal,
  toFix: a.toFix + b.toFix,
});

const pickCounts = (source: Counts): Counts => ({
  requiredLeft: source.requiredLeft,
  requiredTotal: source.requiredTotal,
  optionalLeft: source.optionalLeft,
  optionalTotal: source.optionalTotal,
  toFix: source.toFix,
});

const statusOf = (counts: Counts, filledAny: boolean): CompletionStatus => {
  if (counts.toFix > 0) return "error";
  if (counts.requiredLeft === 0) return "done";
  return filledAny ? "partial" : "todo";
};

const todayIso = (now: number): string => new Date(now).toISOString().slice(0, 10);

// Format problems: everything the lenient schema rejects, plus two rules that depend on the rest of the draft or on
// the clock and therefore never block a save.
const collectIssues = (draft: DepositionDraft, now: number): Issue[] => {
  const parsed = draftSchema.safeParse(draft);
  // Our own codes are snake_case identifiers; anything else is a stock Zod message, so its issue code stands in.
  const issues: Issue[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({ path: issue.path, code: /^[a-z_]+$/.test(issue.message) ? issue.message : issue.code }));

  const until = draft.study.embargo?.until;
  if (draft.study.access === "embargoed" && until && isValidIsoDate(until) && until <= todayIso(now)) {
    issues.push({ path: ["study", "embargo", "until"], code: "date_not_future" });
  }

  const seen = new Set<string>();
  draft.runs.forEach((run, index) => {
    const name = run.name?.trim().toLowerCase();
    if (!name) return;
    if (seen.has(name)) issues.push({ path: ["runs", index, "name"], code: "duplicate_name" });
    seen.add(name);
  });
  return issues;
};

type Scoped<Scope> = {
  stepId: StepId;
  scope: Scope;
  runId?: string;
  location: string;
  // Issues already narrowed to this scope, paths relative to it.
  issues: Issue[];
};

const relativeIssues = (issues: Issue[], prefix: readonly PropertyKey[]): Issue[] =>
  issues
    .filter((issue) => prefix.every((segment, index) => issue.path[index] === segment))
    .map((issue) => ({ ...issue, path: issue.path.slice(prefix.length) }));

const matchesPath = (issuePath: string, fieldPath: string): boolean => issuePath === fieldPath || issuePath.startsWith(`${fieldPath}.`);

const evaluateSection = <Scope>(spec: SectionSpec<Scope>, context: Scoped<Scope>): SectionResult | null => {
  if (spec.applies && !spec.applies(context.scope)) return null;
  if (spec.addableKey !== undefined && (context.scope as Record<string, unknown>)[spec.addableKey] === undefined) return null;

  let counts = ZERO;
  let filledAny = false;
  const missing: FieldRef[] = [];
  const fixes: FieldRef[] = [];
  const claimed = new Set<string>();

  for (const field of spec.fields) {
    if (field.applies && !field.applies(context.scope)) continue;
    const filled = isFieldFilled(field, context.scope);
    filledAny ||= filled;
    const ref = (kind: FieldRef["kind"], code?: string): FieldRef => ({
      stepId: context.stepId,
      sectionId: spec.id,
      ...(context.runId !== undefined && { runId: context.runId }),
      path: field.path,
      label: field.label,
      location: context.location,
      anchor: fieldAnchor(spec.id, field.path),
      kind,
      ...(code !== undefined && { code }),
    });

    if (isFieldRequired(field, context.scope)) {
      counts = { ...counts, requiredTotal: counts.requiredTotal + 1 };
      if (!filled) {
        counts = { ...counts, requiredLeft: counts.requiredLeft + 1 };
        missing.push(ref("missing"));
      }
    } else {
      counts = { ...counts, optionalTotal: counts.optionalTotal + 1 };
      if (!filled) counts = { ...counts, optionalLeft: counts.optionalLeft + 1 };
    }

    const owned = field.issuePaths ?? [field.path];
    for (const issue of context.issues) {
      const key = issue.path.join(".");
      if (claimed.has(key) || !owned.some((path) => matchesPath(key, path))) continue;
      claimed.add(key);
      counts = { ...counts, toFix: counts.toFix + 1 };
      fixes.push(ref("format", issue.code));
    }
  }

  return { id: spec.id, title: spec.title, status: statusOf(counts, filledAny), filledAny, missing, fixes, ...counts };
};

const evaluateSections = <Scope>(specs: readonly SectionSpec<Scope>[], context: Scoped<Scope>) => {
  const sections = specs.flatMap((spec) => evaluateSection(spec, context) ?? []);
  const counts = sections.reduce<Counts>((sum, section) => addCounts(sum, section), ZERO);
  const filledAny = sections.some((section) => section.filledAny);
  return { sections, counts, filledAny };
};

const evaluateRun = (run: Run, index: number, issues: Issue[]): RunResult => {
  const name = run.name?.trim() || null;
  const { sections, counts, filledAny } = evaluateSections(RUN_SECTIONS, {
    stepId: "experiments",
    scope: run,
    runId: run.id,
    location: `Experiments - ${name ?? "Unnamed run"}`,
    issues: relativeIssues(issues, ["runs", index]),
  });
  return { id: run.id, name, status: statusOf(counts, filledAny), sections, ...counts };
};

const stepTitle = (id: StepId): string => STEPS.find((step) => step.id === id)?.title ?? id;

const computeCompleteness = (draft: DepositionDraft, options: { now?: number } = {}): Completeness => {
  const issues = collectIssues(draft, options.now ?? Date.now());

  const study = evaluateSections(STUDY_SECTIONS, {
    stepId: "study",
    scope: draft.study,
    location: stepTitle("study"),
    issues: relativeIssues(issues, ["study"]),
  });
  const system = evaluateSections(SYSTEM_SECTIONS, {
    stepId: "system",
    scope: draft.system,
    location: stepTitle("system"),
    issues: relativeIssues(issues, ["system"]),
  });
  const runs = draft.runs.map((run, index) => evaluateRun(run, index, issues));

  // Without runs the step still owes one unit ("add a run") so Publish stays blocked and the sidebar shows "1 required".
  const noRuns: Counts = runs.length === 0 ? { ...ZERO, requiredLeft: 1, requiredTotal: 1 } : ZERO;
  const experimentCounts = runs.reduce<Counts>((sum, run) => addCounts(sum, run), noRuns);

  const withLocation = (sections: SectionResult[], step: StepId): SectionResult[] =>
    sections.map((section) => ({
      ...section,
      missing: section.missing.map((ref) => ({ ...ref, location: `${stepTitle(step)} - ${section.title}` })),
      fixes: section.fixes.map((ref) => ({ ...ref, location: `${stepTitle(step)} - ${section.title}` })),
    }));

  const studySections = withLocation(study.sections, "study");
  const systemSections = withLocation(system.sections, "system");

  const steps: StepResult[] = [
    { id: "study", title: stepTitle("study"), status: statusOf(study.counts, study.filledAny), sections: studySections, runs: [], ...pickCounts(study.counts) },
    { id: "system", title: stepTitle("system"), status: statusOf(system.counts, system.filledAny), sections: systemSections, runs: [], ...pickCounts(system.counts) },
    {
      id: "experiments",
      title: stepTitle("experiments"),
      status: runs.length === 0 ? "todo" : statusOf(experimentCounts, runs.some((run) => run.status !== "todo")),
      sections: [],
      runs,
      ...pickCounts(experimentCounts),
    },
  ];

  const total = steps.reduce<Counts>((sum, step) => addCounts(sum, step), ZERO);
  const noRunsRef: FieldRef[] =
    runs.length === 0
      ? [{ stepId: "experiments", sectionId: "runs", path: "runs", label: "At least one run", location: "Experiments", anchor: "runs", kind: "missing" }]
      : [];

  const missing = [
    ...studySections.flatMap((section) => section.missing),
    ...systemSections.flatMap((section) => section.missing),
    ...noRunsRef,
    ...runs.flatMap((run) => run.sections.flatMap((section) => section.missing)),
  ];
  const fixes = [
    ...studySections.flatMap((section) => section.fixes),
    ...systemSections.flatMap((section) => section.fixes),
    ...runs.flatMap((run) => run.sections.flatMap((section) => section.fixes)),
  ];

  return {
    steps,
    requiredLeft: total.requiredLeft,
    requiredTotal: total.requiredTotal,
    optionalLeft: total.optionalLeft,
    toFix: total.toFix,
    completion: total.requiredTotal === 0 ? 0 : Math.round(((total.requiredTotal - total.requiredLeft) / total.requiredTotal) * 100),
    ready: total.requiredLeft === 0 && total.toFix === 0,
    missing,
    fixes,
  };
};

// Where "open this draft" should land: the first step that is not done, else the review page.
const firstIncompleteStep = (completeness: Completeness): StepId | "review" =>
  completeness.steps.find((step) => step.status !== "done")?.id ?? "review";

export { computeCompleteness, firstIncompleteStep };
export type { Completeness, CompletionStatus, Counts, FieldRef, RunResult, SectionResult, StepResult };
