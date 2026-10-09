"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@e-infra/design-system";
import { Controller, useFormState, useWatch } from "react-hook-form";
import { BOX_SHAPES_WITH_ANGLES, type SectionResult } from "@/entities/deposition";
import { Icon } from "@/shared/ui/icons";
import { BOX_SHAPE_LABELS, BOX_SHAPES } from "../lib/options";
import { errorCopy, FIELD_COPY, REQUIRED_COPY } from "../lib/messages";
import type { SystemForm } from "../model/useSystemForm";
import { FieldFrame } from "@/entities/deposition/ui";
import { NumberInput } from "@/entities/deposition/ui";
import { FormSection } from "@/entities/deposition/ui";

type DimensionsSectionProps = {
  form: SystemForm;
  result: SectionResult | undefined;
};

const AXES = [
  { name: "box.a", label: "X" },
  { name: "box.b", label: "Y" },
  { name: "box.c", label: "Z" },
] as const;

const ANGLES = [
  { name: "box.alpha", label: "α" },
  { name: "box.beta", label: "β" },
  { name: "box.gamma", label: "γ" },
] as const;

const DimensionsSection = ({ form, result }: DimensionsSectionProps) => {
  const shape = useWatch({ control: form.control, name: "box.shape" });
  const { errors } = useFormState({ control: form.control });
  const needsAngles = shape !== undefined && BOX_SHAPES_WITH_ANGLES.includes(shape);
  const box = errors.box;

  return (
    <FormSection id="dimensions" title="Dimensions" description="How big the system is and what box it sits in." result={result}>
      <FieldFrame sectionId="dimensions" path="box.shape" label="Box shape">
        {(ids) => (
          <Controller
            control={form.control}
            name="box.shape"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={(next) => next && field.onChange(next)}>
                <SelectTrigger {...ids} className="w-full" onBlur={field.onBlur}>
                  <SelectValue placeholder="Choose box shape">
                    {field.value ? (
                      <>
                        <Icon name="shape-triclinic-22" className="size-5" />
                        {BOX_SHAPE_LABELS[field.value]}
                      </>
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BOX_SHAPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      <Icon name="shape-triclinic-22" className="size-5" />
                      {BOX_SHAPE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FieldFrame>

      <FieldFrame
        sectionId="dimensions"
        path="systemSize"
        label="System size"
        required
        requiredMessage={REQUIRED_COPY["systemSize"]}
        error={errorCopy([errors.systemSize?.message], FIELD_COPY.systemSize)}
        hint="All atoms in the box, including water and ions."
      >
        {(ids) => (
          <Controller
            control={form.control}
            name="systemSize"
            render={({ field }) => (
              <NumberInput
                {...ids}
                integer
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                endAdornment="atoms"
                containerClassName="max-w-57.5"
              />
            )}
          />
        )}
      </FieldFrame>

      <FieldFrame
        sectionId="dimensions"
        path="box.vectors"
        label="Box vectors"
        labelNote="nm"
        required
        group
        sourcePaths={["box.a", "box.b", "box.c"]}
        requiredMessage={REQUIRED_COPY["box.vectors"]}
        error={errorCopy([box?.a?.message, box?.b?.message, box?.c?.message], FIELD_COPY.vectors)}
        hint={needsAngles || shape === undefined ? "Edge lengths of the periodic box." : "Angles are fixed for this shape."}
      >
        {(ids) => (
          <div className="grid gap-2 sm:grid-cols-3">
            {AXES.map((axis) => (
              <Controller
                key={axis.name}
                control={form.control}
                name={axis.name}
                render={({ field }) => (
                  <NumberInput
                    aria-label={`Box vector ${axis.label}, nm`}
                    aria-describedby={ids["aria-describedby"]}
                    aria-invalid={ids["aria-invalid"]}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    startAdornment={axis.label}
                    endAdornment="nm"
                  />
                )}
              />
            ))}
          </div>
        )}
      </FieldFrame>

      {needsAngles ? (
        <FieldFrame
          sectionId="dimensions"
          path="box.angles"
          label="Box angles"
          labelNote="degrees"
          required
          group
          sourcePaths={["box.alpha", "box.beta", "box.gamma"]}
          requiredMessage={REQUIRED_COPY["box.angles"]}
          error={errorCopy([box?.alpha?.message, box?.beta?.message, box?.gamma?.message], FIELD_COPY.angles)}
          hint="A triclinic box needs its own angles, so all six values are entered."
        >
          {(ids) => (
            <div className="grid gap-2 sm:grid-cols-3">
              {ANGLES.map((angle) => (
                <Controller
                  key={angle.name}
                  control={form.control}
                  name={angle.name}
                  render={({ field }) => (
                    <NumberInput
                      aria-label={`Box angle ${angle.label}, degrees`}
                      aria-describedby={ids["aria-describedby"]}
                      aria-invalid={ids["aria-invalid"]}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      startAdornment={angle.label}
                      endAdornment="°"
                    />
                  )}
                />
              ))}
            </div>
          )}
        </FieldFrame>
      ) : null}
    </FormSection>
  );
};

export { DimensionsSection };
