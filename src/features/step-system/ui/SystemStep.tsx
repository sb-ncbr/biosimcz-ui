"use client";

import { Accordion } from "@e-infra/design-system";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider } from "react-hook-form";
import { SYSTEM_SECTIONS, type SectionResult } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { sourceOf } from "../lib/prefill";
import { useShowRequired } from "@/shared/lib/showRequired";
import { useSystemForm } from "../model/useSystemForm";
import { CompositionSection } from "./CompositionSection";
import { DimensionsSection } from "./DimensionsSection";
import { EngineSection } from "./EngineSection";
import { StepContext, type StepContextValue } from "@/entities/deposition/ui";
import { SystemFilesSection } from "./SystemFilesSection";
import { useSystemUploadsContext } from "./SystemUploadsProvider";

const SECTION_IDS = SYSTEM_SECTIONS.map((section) => section.id);
const FOCUSABLE = "input:not([type=file]), textarea, select, button[role=combobox], [role=radio][aria-checked=true], button";

// Anchors look like field-<sectionId>-<path>; the section id may itself contain no dash, so the prefix is enough.
const sectionOfAnchor = (anchor: string): string | undefined => SECTION_IDS.find((id) => anchor.startsWith(`field-${id}-`));

// Step 2, Molecular system (115:121): four accordion sections wired to the draft. Every section is open by default, as
// in the approved frame; hash links (#engine, #field-dimensions-box-vectors) open and focus their target.
const SystemStep = () => {
  const { draftId, draft, completeness } = useDraft();
  const form = useSystemForm();
  // Owned by SystemUploadsProvider in the wizard layout, so uploads keep running when the user leaves this step.
  const files = useSystemUploadsContext();
  const [open, setOpen] = useState<string[]>(SECTION_IDS);
  const [showRequired, enableShowRequired] = useShowRequired(draftId);

  const sections = useMemo(() => {
    const step = completeness.steps.find((candidate) => candidate.id === "system");
    return new Map<string, SectionResult>((step?.sections ?? []).map((section) => [section.id, section]));
  }, [completeness]);

  const missing = useMemo(
    () => new Set([...sections.values()].flatMap((section) => section.missing.map((field) => field.path))),
    [sections],
  );

  const focusTarget = useCallback((anchor: string) => {
    const section = sectionOfAnchor(anchor);
    if (section) setOpen((current) => (current.includes(section) ? current : [...current, section]));
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

  // "Go to field" from Review arrives as /system#field-...; a plain #engine only opens and scrolls to the section.
  useEffect(() => {
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash.startsWith("field-")) goToField(hash);
      else if (SECTION_IDS.includes(hash)) {
        setOpen((current) => (current.includes(hash) ? current : [...current, hash]));
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

  const context = useMemo<StepContextValue>(
    () => ({
      showRequired,
      missing,
      sourceOf: (paths) => sourceOf(draft.system, paths),
    }),
    [showRequired, missing, draft.system],
  );

  return (
    <StepContext value={context}>
      <FormProvider {...form}>
        <form noValidate onSubmit={(event) => event.preventDefault()} aria-label="Molecular system">
          <Accordion type="multiple" value={open} onValueChange={setOpen} className="flex flex-col gap-4">
            <SystemFilesSection result={sections.get("systemFiles")} files={files} onGoTo={goToField} />
            <EngineSection form={form} result={sections.get("engine")} />
            <CompositionSection form={form} result={sections.get("composition")} />
            <DimensionsSection form={form} result={sections.get("dimensions")} />
          </Accordion>
        </form>
      </FormProvider>
    </StepContext>
  );
};

export { SystemStep };
