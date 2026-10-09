"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { runSchema, type Run } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { cleanNumbers, nullsToUndefined, stableKey } from "@/shared/lib";

// The parts of a run the form edits. The id (identity) and fileKeys (uploads) are written by the step itself.
const runFormSchema = runSchema.omit({ id: true, fileKeys: true });

type RunFormInput = z.input<typeof runFormSchema>;
type RunFormOutput = z.output<typeof runFormSchema>;
type RunForm = UseFormReturn<RunFormInput, unknown, RunFormOutput>;

const pickOwned = (run: Run): RunFormInput => {
  const { id, fileKeys, ...owned } = run;
  void id;
  void fileKeys;
  return owned;
};

// Same two-way sync as the system step: edits flow form -> draft (autosave and the counts follow), anything else that
// changes the draft (restore, reload from server) flows draft -> form. Errors show on blur, then on change.
const useRunForm = (run: Run): RunForm => {
  const { updateDraft } = useDraft();
  const runId = run.id;
  const form = useForm<RunFormInput, unknown, RunFormOutput>({
    resolver: (values, context, options) => zodResolver(runFormSchema)(nullsToUndefined(values) as RunFormInput, context, options),
    defaultValues: pickOwned(run),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const agreed = useRef(stableKey(pickOwned(run)));

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        const owned = cleanNumbers(values) as RunFormInput;
        const key = stableKey(owned);
        if (key === agreed.current) return;
        agreed.current = key;
        updateDraft((draft) => ({
          ...draft,
          runs: draft.runs.map((candidate) =>
            candidate.id === runId ? ({ id: candidate.id, fileKeys: candidate.fileKeys, ...owned } as Run) : candidate,
          ),
        }));
      },
    });
    return unsubscribe;
  }, [form, runId, updateDraft]);

  useEffect(() => {
    const owned = pickOwned(run);
    const key = stableKey(owned);
    if (key === agreed.current) return;
    agreed.current = key;
    form.reset(owned);
  }, [run, form]);

  return form;
};

export { runFormSchema, useRunForm };
export type { RunForm, RunFormInput, RunFormOutput };
