"use client";

import { useFormState } from "react-hook-form";
import type { SectionResult } from "@/entities/deposition";
import { FieldFrame } from "@/entities/deposition/ui";
import { FormSection } from "@/entities/deposition/ui";
import { errorCopy, NUMBER_COPY, REQUIRED_COPY } from "../lib/messages";
import { BAROSTATS, COUPLING_TYPES, THERMOSTATS } from "../lib/options";
import type { RunForm } from "../model/useRunForm";
import { errorMessage, NumberControl, SelectControl, TextControl } from "./controls";

type EnvironmentSectionProps = {
  form: RunForm;
  result: SectionResult | undefined;
};

// "Temperature" (191:455): present and required for NVT and NpT runs.
const TemperatureSection = ({ form, result }: EnvironmentSectionProps) => {
  const { errors } = useFormState({ control: form.control });
  return (
    <FormSection id="temperature" title="Temperature" description="Thermostat and target temperature." result={result}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldFrame
          sectionId="temperature"
          path="temperature.thermostat"
          label="Thermostat"
          required
          requiredMessage={REQUIRED_COPY["temperature.thermostat"]}
        >
          {(ids) => <SelectControl form={form} name="temperature.thermostat" ids={ids} placeholder="Choose thermostat" options={THERMOSTATS} />}
        </FieldFrame>
        <FieldFrame
          sectionId="temperature"
          path="temperature.referenceK"
          label="Reference temperature"
          required
          requiredMessage={REQUIRED_COPY["temperature.referenceK"]}
          error={errorCopy(errorMessage(errors, "temperature.referenceK"), NUMBER_COPY)}
        >
          {(ids) => <NumberControl form={form} name="temperature.referenceK" ids={ids} unit="K" />}
        </FieldFrame>
        <FieldFrame sectionId="temperature" path="temperature.couplingGroups" label="Coupling groups" labelNote="Optional">
          {(ids) => <TextControl form={form} name="temperature.couplingGroups" ids={ids} placeholder="Protein, Non-protein" />}
        </FieldFrame>
      </div>
      <p className="text-text-muted -mt-2 text-[11px] leading-4">
        Which thermostat kept the run at temperature, at what value, and on which groups.
      </p>
    </FormSection>
  );
};

// "Pressure" (191:530): present and required for NpT runs.
const PressureSection = ({ form, result }: EnvironmentSectionProps) => {
  const { errors } = useFormState({ control: form.control });
  return (
    <FormSection id="pressure" title="Pressure" description="Barostat and target pressure." result={result}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldFrame sectionId="pressure" path="pressure.barostat" label="Barostat" required requiredMessage={REQUIRED_COPY["pressure.barostat"]}>
          {(ids) => <SelectControl form={form} name="pressure.barostat" ids={ids} placeholder="Choose barostat" options={BAROSTATS} />}
        </FieldFrame>
        <FieldFrame
          sectionId="pressure"
          path="pressure.referenceBar"
          label="Reference pressure"
          required
          requiredMessage={REQUIRED_COPY["pressure.referenceBar"]}
          error={errorCopy(errorMessage(errors, "pressure.referenceBar"), "Enter a number.")}
        >
          {(ids) => <NumberControl form={form} name="pressure.referenceBar" ids={ids} unit="bar" />}
        </FieldFrame>
        <FieldFrame sectionId="pressure" path="pressure.couplingType" label="Coupling type" labelNote="Optional">
          {(ids) => <SelectControl form={form} name="pressure.couplingType" ids={ids} placeholder="Choose type" options={COUPLING_TYPES} />}
        </FieldFrame>
      </div>
      <p className="text-text-muted -mt-2 text-[11px] leading-4">
        Which barostat kept the run at pressure, at what value, and how the box was scaled.
      </p>
    </FormSection>
  );
};

export { PressureSection, TemperatureSection };
