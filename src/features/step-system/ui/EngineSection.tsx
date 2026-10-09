"use client";

import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@e-infra/design-system";
import { Controller, useWatch } from "react-hook-form";
import type { SectionResult } from "@/entities/deposition";
import { withCurrent } from "@/shared/lib";
import { ENGINES } from "../lib/options";
import { REQUIRED_COPY } from "../lib/messages";
import type { SystemForm } from "../model/useSystemForm";
import { FieldFrame } from "@/entities/deposition/ui";
import { FormSection } from "@/entities/deposition/ui";

type EngineSectionProps = {
  form: SystemForm;
  result: SectionResult | undefined;
};

const EngineSection = ({ form, result }: EngineSectionProps) => {
  // Radix Select reports "" while its options are not mounted yet (e.g. right after a prefill); that is not a choice, so
  // every Select in this step ignores empty values.
  const engine = useWatch({ control: form.control, name: "engine.name" });
  const version = useWatch({ control: form.control, name: "engine.version" });
  const versions = withCurrent(engine ? (ENGINES[engine] ?? []) : [], version);

  return (
    <FormSection id="engine" title="Engine" description="The software that ran your simulation." result={result}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldFrame sectionId="engine" path="engine.name" label="Engine" required requiredMessage={REQUIRED_COPY["engine.name"]}>
          {(ids) => (
            <Controller
              control={form.control}
              name="engine.name"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(next) => next && field.onChange(next)}>
                  <SelectTrigger {...ids} className="w-full" onBlur={field.onBlur}>
                    <SelectValue placeholder="Choose engine">{field.value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {withCurrent(Object.keys(ENGINES), field.value).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FieldFrame>
        <FieldFrame sectionId="engine" path="engine.version" label="Version" required requiredMessage={REQUIRED_COPY["engine.version"]}>
          {(ids) => (
            <Controller
              control={form.control}
              name="engine.version"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(next) => next && field.onChange(next)}>
                  <SelectTrigger {...ids} className="w-full" onBlur={field.onBlur}>
                    <SelectValue placeholder={engine ? "Choose version" : "Choose engine first"}>{field.value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FieldFrame>
        <FieldFrame sectionId="engine" path="engine.build" label="Build" labelNote="Optional">
          {(ids) => (
            <Controller
              control={form.control}
              name="engine.build"
              render={({ field }) => (
                <Input
                  {...ids}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="e.g. GPU/CUDA"
                  autoComplete="off"
                />
              )}
            />
          )}
        </FieldFrame>
      </div>
      <p className="text-text-muted -mt-2 text-[11px] leading-4">
        Applies to the whole deposition. Version matters for reproducibility, build only when it changes the results.
      </p>
    </FormSection>
  );
};

export { EngineSection };
