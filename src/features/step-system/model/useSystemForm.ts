"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useDraft } from "@/features/draft";
import { cleanNumbers, nullsToUndefined, stableKey } from "@/shared/lib";
import { dropEditedSources } from "../lib/prefill";
import { pickOwned, systemFormSchema, type SystemFormInput, type SystemFormOutput } from "../lib/values";
type SystemForm = UseFormReturn<SystemFormInput, unknown, SystemFormOutput>;

const OWNED_KEYS = ["engine", "forceField", "startingStructure", "molecules", "systemSize", "box"] as const;

// The form edits `system`; the draft (DraftProvider) stays the single source that autosave reads. Edits flow form ->
// draft on every change; anything else that changes the draft (restore, reload from server, prefill) flows draft -> form.
// Errors show on blur, then on change once shown (missing-states 3.1); required rules never block typing.
const useSystemForm = (): SystemForm => {
  const { draft, updateDraft } = useDraft();
  const form = useForm<SystemFormInput, unknown, SystemFormOutput>({
    resolver: (values, context, options) => zodResolver(systemFormSchema)(nullsToUndefined(values) as SystemFormInput, context, options),
    defaultValues: pickOwned(draft.system),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  // What the form and the draft last agreed on; lets each side ignore the echo of the other.
  const agreed = useRef(stableKey(pickOwned(draft.system)));

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        const owned = cleanNumbers(values) as SystemFormInput;
        const key = stableKey(owned);
        if (key === agreed.current) return;
        agreed.current = key;
        updateDraft((current) => {
          const rest: Record<string, unknown> = { ...current.system };
          for (const owner of OWNED_KEYS) delete rest[owner];
          const system = {
            ...rest,
            ...owned,
            molecules: owned.molecules ?? [],
          } as typeof current.system;
          return {
            ...current,
            system: {
              ...system,
              fieldSources: dropEditedSources(current.system, owned),
            },
          };
        });
      },
    });
    return unsubscribe;
  }, [form, updateDraft]);

  useEffect(() => {
    const owned = pickOwned(draft.system);
    const key = stableKey(owned);
    if (key === agreed.current) return;
    agreed.current = key;
    form.reset(owned);
  }, [draft.system, form]);

  return form;
};

export { useSystemForm };
export type { SystemForm };
