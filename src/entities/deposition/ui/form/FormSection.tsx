"use client";

import { AccordionContent, AccordionItem, AccordionTrigger, Badge } from "@e-infra/design-system";
import type { ReactNode } from "react";
import type { SectionResult } from "../../model/completeness";
import { StepStatusIcon } from "../StepStatusIcon";
import { cn } from "@/shared/lib";
import { CountBadge } from "@/shared/ui";

type FormSectionProps = {
  id: string;
  title: string;
  description: string;
  // Live counts from computeCompleteness; absent only in isolated tests.
  result: SectionResult | undefined;
  // Extra header text such as "2 of 3 uploaded".
  meta?: ReactNode;
  children: ReactNode;
};

const pluralFix = (count: number): string => `${count} to fix`;

// Accordion item with the approved header (batch-a 1.4): status icon, title, count pill, description, chevron.
const FormSection = ({ id, title, description, result, meta, children }: FormSectionProps) => {
  const toFix = result?.toFix ?? 0;
  const requiredLeft = result?.requiredLeft ?? 0;
  return (
    <AccordionItem value={id} id={id} className="scroll-mt-24 border-b-0">
      <AccordionTrigger className="bg-surface items-center rounded-lg px-4 py-4 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <StepStatusIcon status={result?.status ?? "todo"} size={16} className="mt-0.5" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-text text-sm font-semibold">{title}</span>
              {toFix > 0 ? (
                <Badge variant="error" className="text-[11px]">
                  {pluralFix(toFix)}
                </Badge>
              ) : (
                <>
                  <CountBadge count={requiredLeft} />
                  {requiredLeft === 0 ? <CountBadge count={result?.optionalLeft ?? 0} variant="optional" /> : null}
                </>
              )}
              {meta ? <span className="text-text-muted text-[11px] font-normal">{meta}</span> : null}
            </span>
            <span className="text-text-muted text-xs font-normal">{description}</span>
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className={cn("relative flex flex-col gap-4 pt-4 pb-4 pl-6.5")}>
        <span aria-hidden="true" className="bg-border absolute top-4 bottom-4 left-1.5 w-0.5 rounded-full" />
        {children}
      </AccordionContent>
    </AccordionItem>
  );
};

export { FormSection };
export type { FormSectionProps };
