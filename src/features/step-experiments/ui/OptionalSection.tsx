"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormState } from "react-hook-form";
import type { Run, SectionResult, SectionSpec } from "@/entities/deposition";
import { FieldFrame } from "@/entities/deposition/ui";
import { FormSection } from "@/entities/deposition/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  buttonVariants,
} from "@/shared/ui";
import { errorCopy, INTEGER_COPY, NUMBER_COPY } from "../lib/messages";
import { OPTIONAL_FIELDS, sectionHasValues } from "../lib/optionalSections";
import type { RunForm } from "../model/useRunForm";
import { errorMessage, NumberControl, SelectControl } from "./controls";

type OptionalSectionProps = {
  form: RunForm;
  run: Run;
  spec: SectionSpec<Run>;
  result: SectionResult | undefined;
  onRemove: (spec: SectionSpec<Run>) => void;
};

// An optional section the user added from "Sections you can add": an ordinary accordion section with a way back out.
const OptionalSection = ({ form, run, spec, result, onRemove }: OptionalSectionProps) => {
  const { errors } = useFormState({ control: form.control });
  const [confirming, setConfirming] = useState(false);
  const fields = OPTIONAL_FIELDS[spec.id] ?? [];
  const key = spec.addableKey;

  const remove = () => {
    setConfirming(false);
    onRemove(spec);
  };

  return (
    <FormSection id={spec.id} title={spec.title} description={spec.description} result={result}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldFrame
            key={field.path}
            sectionId={spec.id}
            path={field.path}
            label={field.label}
            labelNote={field.unit && field.kind === "select" ? field.unit : "Optional"}
            error={errorCopy(errorMessage(errors, field.path), field.kind === "integer" ? INTEGER_COPY : NUMBER_COPY)}
          >
            {(ids) =>
              field.kind === "select" ? (
                <SelectControl form={form} name={field.path} ids={ids} placeholder={`Choose ${field.label.toLowerCase()}`} options={field.options ?? []} />
              ) : (
                <NumberControl form={form} name={field.path} ids={ids} unit={field.unit} integer={field.kind === "integer"} />
              )
            }
          </FieldFrame>
        ))}
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-text-muted"
          onClick={() => (key && sectionHasValues(run, key) ? setConfirming(true) : remove())}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Remove section
        </Button>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {spec.title}?</AlertDialogTitle>
            <AlertDialogDescription>The values you entered in this section are deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "error" })} onClick={remove}>
              Remove section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormSection>
  );
};

export { OptionalSection };
export type { OptionalSectionProps };
