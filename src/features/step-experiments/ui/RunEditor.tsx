"use client";

import { Accordion } from "@e-infra/design-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, type Path } from "react-hook-form";
import { fieldAnchor, ghostSections, RUN_SECTIONS, type Run, type SectionResult, type SectionSpec } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { useShowRequired } from "@/shared/lib/showRequired";
import { StepContext, type StepContextValue } from "@/entities/deposition/ui";
import { GhostSection, GhostSectionList } from "@/shared/ui";
import { OPTIONAL_FIELDS } from "../lib/optionalSections";
import { takeJustCreated } from "../model/justCreated";
import { useRunForm, type RunFormInput } from "../model/useRunForm";
import type { UseUploads } from "@/features/upload";
import { useRunUploads } from "../model/useRunUploads";
import { BasicsSection } from "./BasicsSection";
import { PressureSection, TemperatureSection } from "./EnvironmentSections";
import { OptionalSection } from "./OptionalSection";
import { RunFilesSection } from "./RunFilesSection";
import { useRunUploadsRegistry } from "./RunUploadsProvider";

const FOCUSABLE = "input:not([type=file]), textarea, select, button[role=combobox], [role=radio][aria-checked=true], button";
const SECTION_IDS = RUN_SECTIONS.map((section) => section.id);

// Anchors look like field-<sectionId>-<path>; "files" and "basics" never prefix another id.
const sectionOfAnchor = (anchor: string): string | undefined => SECTION_IDS.find((id) => anchor.startsWith(`field-${id}-`));

const isShown = (spec: SectionSpec<Run>, run: Run): boolean =>
  (spec.applies?.(run) ?? true) && (spec.addableKey === undefined || run[spec.addableKey] !== undefined);

type RunEditorProps = {
  runId: string;
  // Test seam for the upload transport; production uses the XHR one.
  uploadOptions?: Parameters<typeof useRunUploads>[1];
};

// Run editor (191:23, 195:2572): sections appear progressively. Files and Basics always; once a simulation type is chosen
// the rest follows the ensemble rules of the registry. Renders nothing for an unknown run; the page shows "Run not found".
const RunEditor = ({ runId, uploadOptions }: RunEditorProps) => {
  const { draft } = useDraft();
  const hoisted = useRunUploadsRegistry();
  const run = draft.runs.find((candidate) => candidate.id === runId);
  if (!run) return null;
  // With the wizard's provider the queue outlives this screen; the first frame has no queue yet and renders nothing.
  if (hoisted) {
    const uploads = hoisted.get(runId);
    return uploads ? <RunEditorBody key={runId} run={run} uploads={uploads} /> : null;
  }
  return <OwnUploadsEditor key={runId} run={run} uploadOptions={uploadOptions} />;
};

const OwnUploadsEditor = ({ run, uploadOptions }: { run: Run; uploadOptions: RunEditorProps["uploadOptions"] }) => {
  const uploads = useRunUploads(run, uploadOptions);
  return <RunEditorBody run={run} uploads={uploads} />;
};

type BodyProps = { run: Run; uploads: UseUploads };

const RunEditorBody = ({ run, uploads }: BodyProps) => {
  const { draftId, completeness } = useDraft();
  const form = useRunForm(run);
  const [showRequired, enableShowRequired] = useShowRequired(draftId);
  const [closed, setClosed] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const shown = useMemo(() => RUN_SECTIONS.filter((spec) => isShown(spec, run)), [run]);
  const shownIds = useMemo(() => shown.map((spec) => spec.id), [shown]);
  const open = shownIds.filter((id) => !closed.includes(id));

  const results = useMemo(() => {
    const result = completeness.steps.find((step) => step.id === "experiments")?.runs.find((candidate) => candidate.id === run.id);
    return new Map<string, SectionResult>((result?.sections ?? []).map((section) => [section.id, section]));
  }, [completeness, run.id]);

  const missing = useMemo(
    () => new Set([...results.values()].flatMap((section) => section.missing.map((field) => field.path))),
    [results],
  );

  // New run: focus the Name input with its text selected (missing-states 5.4), once.
  const focusPending = useRef<boolean | null>(null);
  useEffect(() => {
    focusPending.current ??= takeJustCreated(run.id);
    if (!focusPending.current) return;
    const frame = requestAnimationFrame(() => {
      const input = document.getElementById(fieldAnchor("basics", "name"))?.querySelector<HTMLInputElement>("input");
      input?.focus();
      input?.select();
      focusPending.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [run.id]);

  // What appears after the first render (type chosen, ensemble changed) is announced politely.
  const previous = useRef({ ids: shownIds, typed: run.simulationType !== undefined });
  const typed = run.simulationType !== undefined;
  useEffect(() => {
    const added = shownIds.filter((id) => !previous.current.ids.includes(id));
    const justTyped = typed && !previous.current.typed;
    previous.current = { ids: shownIds, typed };
    const titles = added.map((id) => RUN_SECTIONS.find((spec) => spec.id === id)?.title ?? id);
    if (justTyped) titles.unshift("Ensemble", "Length");
    if (titles.length === 0) return;
    setAnnouncement(`${titles.join(", ")} added.`);
  }, [shownIds, typed]);

  const focusTarget = useCallback((anchor: string) => {
    const section = sectionOfAnchor(anchor);
    if (section) setClosed((current) => current.filter((id) => id !== section));
    // The accordion content mounts on the next frame when it was closed.
    requestAnimationFrame(() => {
      const element = document.getElementById(anchor);
      if (!element) return;
      element.scrollIntoView({ block: "center" });
      element.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    });
  }, []);

  const goToField = useCallback(
    (anchor: string) => {
      enableShowRequired();
      focusTarget(anchor);
    },
    [enableShowRequired, focusTarget],
  );

  // "Go to field" from Review arrives as /experiments/<id>#field-...; a plain #temperature only opens the section.
  useEffect(() => {
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash.startsWith("field-")) goToField(hash);
      else if (SECTION_IDS.includes(hash)) {
        setClosed((current) => current.filter((id) => id !== hash));
        requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
      }
    };
    const first = requestAnimationFrame(onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("hashchange", onHash);
    };
  }, [goToField]);

  const addSection = (spec: SectionSpec<Run>) => {
    if (!spec.addableKey) return;
    form.setValue(spec.addableKey as Path<RunFormInput>, {} as never, { shouldDirty: true });
    const first = OPTIONAL_FIELDS[spec.id]?.[0];
    focusTarget(fieldAnchor(spec.id, first?.path ?? spec.id));
  };

  const removeSection = (spec: SectionSpec<Run>) => {
    if (spec.addableKey) form.setValue(spec.addableKey as Path<RunFormInput>, undefined as never, { shouldDirty: true });
  };

  const context = useMemo<StepContextValue>(() => ({ showRequired, missing, sourceOf: () => undefined }), [showRequired, missing]);
  const ghosts = ghostSections(run);

  return (
    <StepContext value={context}>
      <FormProvider {...form}>
        <form noValidate onSubmit={(event) => event.preventDefault()} aria-label="Run settings" className="flex flex-col gap-4">
          <Accordion
            type="multiple"
            value={open}
            onValueChange={(next) => setClosed(shownIds.filter((id) => !next.includes(id)))}
            className="flex flex-col gap-4"
          >
            <RunFilesSection result={results.get("files")} uploads={uploads} />
            <BasicsSection form={form} run={run} result={results.get("basics")} />
            {shownIds.includes("temperature") ? <TemperatureSection form={form} result={results.get("temperature")} /> : null}
            {shownIds.includes("pressure") ? <PressureSection form={form} result={results.get("pressure")} /> : null}
            {shown
              .filter((spec) => spec.addableKey !== undefined)
              .map((spec) => (
                <OptionalSection key={spec.id} form={form} run={run} spec={spec} result={results.get(spec.id)} onRemove={removeSection} />
              ))}
          </Accordion>

          {ghosts.length > 0 ? (
            <GhostSectionList>
              {ghosts.map((spec) => (
                <GhostSection key={spec.id} title={spec.title} description={spec.description} onAdd={() => addSection(spec)} />
              ))}
            </GhostSectionList>
          ) : null}
        </form>
      </FormProvider>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </StepContext>
  );
};

export { RunEditor };
export type { RunEditorProps };
