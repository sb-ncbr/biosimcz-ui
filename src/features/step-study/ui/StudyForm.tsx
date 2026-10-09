"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button } from "@e-infra/design-system";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { draftHref, STUDY_SECTIONS, type Study } from "@/entities/deposition";
import { StepStatusIcon } from "@/entities/deposition/ui";
import { useDraft } from "@/features/draft";
import { CountBadge, GhostSection, GhostSectionList } from "@/shared/ui";
import { createStudyResolver } from "../model/resolver";
import { useShowRequired } from "@/shared/lib/showRequired";
import { StudyContext } from "./context";
import { RelatedWorkList } from "./Lists";
import { BasicsSection, CreditsSection, PublishingSection } from "./Sections";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const RELATED = "relatedWork";

const sectionOfHash = (hash: string): string | null => {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id.startsWith("field-")) return null;
  return STUDY_SECTIONS.find((section) => id.startsWith(`field-${section.id}-`))?.id ?? null;
};

// Step 1. Owns a react-hook-form instance over the study values: edits are pushed into the draft (autosave and the
// counts follow), and values that arrive from outside (restore, reload from server) are pushed back into the form.
const StudyForm = () => {
  const { draftId, draft, completeness, updateDraft } = useDraft();
  const [showRequired, enableShowRequired] = useShowRequired(draftId);
  const resolver = useMemo(() => createStudyResolver(), []);
  const form = useForm<Study>({ defaultValues: draft.study, resolver, mode: "onTouched" });
  const pushed = useRef(draft.study);

  const { subscribe } = form;
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values }) => {
          const next = clone(values);
          if (JSON.stringify(next) === JSON.stringify(pushed.current)) return;
          pushed.current = next;
          updateDraft((current) => ({ ...current, study: next }));
        },
      }),
    [subscribe, updateDraft],
  );

  useEffect(() => {
    if (draft.study === pushed.current) return;
    pushed.current = draft.study;
    form.reset(draft.study);
  }, [draft.study, form]);

  const step = completeness.steps.find((item) => item.id === "study");
  const missing = useMemo(() => new Set((step?.sections ?? []).flatMap((section) => section.missing.map((ref) => ref.anchor))), [step]);

  const relatedCount = useWatch({ control: form.control, name: "relatedWorks" }).length;
  const [relatedAdded, setRelatedAdded] = useState(false);
  const showRelated = relatedAdded || relatedCount > 0;

  const [open, setOpen] = useState<string[]>(() => {
    const opened = new Set(["basics"]);
    for (const section of step?.sections ?? []) {
      if (section.toFix > 0 || (section.requiredLeft > 0 && section.filledAny)) opened.add(section.id);
    }
    if (draft.study.relatedWorks.length > 0) opened.add(RELATED);
    return [...opened];
  });

  // "Go to field": open the section, then scroll to and focus the anchor. The anchor is a fragment on this route.
  const [target, setTarget] = useState<string | null>(null);
  const readHash = useCallback(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const sectionId = sectionOfHash(window.location.hash);
    if (!sectionId) return;
    enableShowRequired();
    if (sectionId === RELATED) setRelatedAdded(true);
    setOpen((current) => (current.includes(sectionId) ? current : [...current, sectionId]));
    setTarget(id);
  }, [enableShowRequired]);

  // The hash exists only on the client, so the first read waits a frame instead of setting state during hydration.
  useEffect(() => {
    const frame = requestAnimationFrame(readHash);
    window.addEventListener("hashchange", readHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", readHash);
    };
  }, [readHash]);

  useEffect(() => {
    if (target === null) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(target);
      if (element) {
        element.scrollIntoView({ block: "center" });
        // Lists and card groups carry the anchor on their wrapper; focus the first control inside it.
        const inner = element.tabIndex === -1 ? element.querySelector<HTMLElement>("input:not([type=hidden]), button:not([disabled]), [role=radio]") : null;
        (inner ?? element).focus({ preventScroll: true });
      }
      setTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, open]);

  const context = useMemo(() => ({ form, draftId, showRequired, missing }), [form, draftId, showRequired, missing]);

  const section = (id: string, title: string, description: string, body: ReactNode) => {
    const result = step?.sections.find((item) => item.id === id);
    const status = result?.status ?? "todo";
    return (
      <AccordionItem key={id} value={id} className="border-b-0" data-section={id}>
        <AccordionTrigger className="bg-surface items-center rounded-lg px-4 py-3.5 hover:no-underline">
          <span className="flex min-w-0 flex-1 items-start gap-2.5">
            <StepStatusIcon status={status} size={16} className="mt-0.5" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{title}</span>
                {result && result.toFix > 0 ? (
                  <Badge variant="error" className="px-2 text-[11px] font-semibold">
                    {result.toFix} to fix
                  </Badge>
                ) : result && result.requiredLeft > 0 ? (
                  <CountBadge count={result.requiredLeft} />
                ) : (
                  <CountBadge count={result?.optionalLeft ?? 0} variant="optional" />
                )}
              </span>
              <span className="text-text-muted text-xs font-normal">{description}</span>
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="border-border mt-2 ml-2 border-l-2 pt-4 pb-4 pl-4">{body}</AccordionContent>
      </AccordionItem>
    );
  };

  const spec = (id: string) => STUDY_SECTIONS.find((item) => item.id === id);

  return (
    <StudyContext.Provider value={context}>
      <form onSubmit={(event) => event.preventDefault()} noValidate className="flex flex-col gap-4">
        <Accordion type="multiple" value={open} onValueChange={setOpen} className="flex flex-col gap-4">
          {section("basics", "Basics", spec("basics")?.description ?? "", <BasicsSection />)}
          {section("credits", "Credits", spec("credits")?.description ?? "", <CreditsSection />)}
          {section("publishing", "Publishing", spec("publishing")?.description ?? "", <PublishingSection />)}
          {showRelated ? section(RELATED, "Related work", spec(RELATED)?.description ?? "", <RelatedWorkList />) : null}
        </Accordion>

        {showRelated ? null : (
          <GhostSectionList>
            <GhostSection
              title="Related work"
              description={spec(RELATED)?.description ?? ""}
              onAdd={() => {
                setRelatedAdded(true);
                setOpen((current) => [...current, RELATED]);
              }}
            />
          </GhostSectionList>
        )}

        <nav aria-label="Next step" className="border-border flex justify-end border-t pt-4">
          <Button asChild variant="link" size="sm" className="text-text font-semibold">
            <Link href={draftHref(draftId, "system")}>
              Molecular system
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </nav>
      </form>
    </StudyContext.Provider>
  );
};

export { StudyForm };
