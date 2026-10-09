"use client";

import { Alert, AlertDescription, ToggleGroup, ToggleGroupItem } from "@e-infra/design-system";
import { useState } from "react";
import { Controller, useFormState } from "react-hook-form";
import { ENSEMBLES, SIMULATION_TYPES, SIMULATION_TYPE_LABELS, type Run, type SectionResult } from "@/entities/deposition";
import { FieldFrame } from "@/entities/deposition/ui";
import { FormSection } from "@/entities/deposition/ui";
import { errorCopy, NUMBER_COPY, REQUIRED_COPY } from "../lib/messages";
import { ENSEMBLE_HINTS } from "../lib/options";
import { hiddenWithValues, isDynamic, lengthUnit } from "../lib/runs";
import type { RunForm } from "../model/useRunForm";
import { errorMessage, NumberControl, SelectControl, TextControl } from "./controls";

type BasicsSectionProps = {
  form: RunForm;
  run: Run;
  result: SectionResult | undefined;
};

const joinNames = (names: string[]): string =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");

// "Basics" (191:351, 195:2572): Name and Simulation type always; the rest appears once a type is chosen.
const BasicsSection = ({ form, run, result }: BasicsSectionProps) => {
  const { errors } = useFormState({ control: form.control });
  const [dismissed, setDismissed] = useState("");
  const typed = run.simulationType !== undefined;
  const dynamic = isDynamic(run);
  const unit = lengthUnit(run.simulationType);
  const hidden = hiddenWithValues(run);
  const hiddenKey = hidden.join(",");
  const reason = run.simulationType === "energy_minimization" ? "energy minimization" : (run.ensemble ?? "this ensemble");
  const plural = hidden.length > 1;

  return (
    <FormSection id="basics" title="Basics" description="What kind of run this was and how long it ran." result={result}>
      <FieldFrame sectionId="basics" path="name" label="Name" required requiredMessage={REQUIRED_COPY["name"]}>
        {(ids) => <TextControl form={form} name="name" ids={ids} />}
      </FieldFrame>

      <FieldFrame
        sectionId="basics"
        path="simulationType"
        label="Simulation type"
        required
        requiredMessage={REQUIRED_COPY["simulationType"]}
        hint="What kind of run this was and under what conditions it ran."
      >
        {(ids) => (
          <SelectControl
            form={form}
            name="simulationType"
            ids={ids}
            placeholder="Select a type"
            options={SIMULATION_TYPES}
            labels={SIMULATION_TYPE_LABELS}
          />
        )}
      </FieldFrame>

      {hidden.length > 0 && dismissed !== hiddenKey ? (
        <Alert className="flex items-start justify-between gap-3">
          <AlertDescription>
            {joinNames(hidden)} {plural ? "are" : "is"} hidden for {reason}. {plural ? "Their values are" : "Its values are"} kept if you switch back.
          </AlertDescription>
          <button
            type="button"
            onClick={() => setDismissed(hiddenKey)}
            className="text-primary focus-visible:ring-border-focus shrink-0 rounded-sm text-xs font-medium outline-none focus-visible:ring-2"
          >
            Dismiss
          </button>
        </Alert>
      ) : null}

      {dynamic ? (
        <FieldFrame
          sectionId="basics"
          path="ensemble"
          label="Ensemble"
          required
          group
          requiredMessage={REQUIRED_COPY["ensemble"]}
          hint={run.ensemble ? ENSEMBLE_HINTS[run.ensemble] : "Which quantities the simulation held constant."}
        >
          {(ids) => (
            <Controller
              control={form.control}
              name="ensemble"
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={field.value ?? ""}
                  onValueChange={(next) => next && field.onChange(next)}
                  aria-label="Ensemble"
                  aria-describedby={ids["aria-describedby"]}
                  className="w-fit"
                  onBlur={field.onBlur}
                >
                  {ENSEMBLES.map((ensemble) => (
                    <ToggleGroupItem key={ensemble} value={ensemble} className="px-4">
                      {ensemble}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          )}
        </FieldFrame>
      ) : null}

      {typed ? (
        <div className="flex flex-col gap-1.5">
          <div className={dynamic ? "grid gap-3 sm:grid-cols-3" : "grid gap-3"}>
            <FieldFrame
              sectionId="basics"
              path="length"
              label="Length"
              required
              requiredMessage={REQUIRED_COPY["length"]}
              error={errorCopy(errorMessage(errors, "length"), NUMBER_COPY)}
            >
              {(ids) => <NumberControl form={form} name="length" ids={ids} unit={unit} />}
            </FieldFrame>
            {dynamic ? (
              <>
                <FieldFrame
                  sectionId="basics"
                  path="timeStep"
                  label="Time step"
                  required
                  requiredMessage={REQUIRED_COPY["timeStep"]}
                  error={errorCopy(errorMessage(errors, "timeStep"), NUMBER_COPY)}
                >
                  {(ids) => <NumberControl form={form} name="timeStep" ids={ids} unit="fs" />}
                </FieldFrame>
                <FieldFrame
                  sectionId="basics"
                  path="outputInterval"
                  label="Output interval"
                  labelNote="Optional"
                  error={errorCopy(errorMessage(errors, "outputInterval"), NUMBER_COPY)}
                >
                  {(ids) => <NumberControl form={form} name="outputInterval" ids={ids} unit="ps" />}
                </FieldFrame>
              </>
            ) : null}
          </div>
          <p className="text-text-muted text-[11px] leading-4">
            {dynamic
              ? "How long the run was, at what step, and how often it was saved (for example every 10 ps)."
              : "How many minimization steps the run took."}
          </p>
        </div>
      ) : null}
    </FormSection>
  );
};

export { BasicsSection };
export type { BasicsSectionProps };
