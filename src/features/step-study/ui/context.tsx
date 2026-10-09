"use client";

import { createContext, useContext } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Study } from "@/entities/deposition";

type StudyContextValue = {
  form: UseFormReturn<Study>;
  draftId: string;
  // "Show required" mode: empty required fields show their message (missing-states 3.1).
  showRequired: boolean;
  // Anchors of the required fields that are still empty, from computeCompleteness.
  missing: ReadonlySet<string>;
};

const StudyContext = createContext<StudyContextValue | null>(null);

const useStudy = (): StudyContextValue => {
  const value = useContext(StudyContext);
  if (!value) throw new Error("useStudy must be used inside StudyForm");
  return value;
};

export { StudyContext, useStudy };
export type { StudyContextValue };
