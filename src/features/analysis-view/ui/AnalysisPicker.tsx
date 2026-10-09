"use client";

import { useRouter } from "next/navigation";
import { groupAnalyses, labelOf, type AnalysisOption } from "@/entities/analysis";
import { replicaHref } from "@/entities/replica";
import { cn } from "@/shared/lib";
import { buttonVariants, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui";

type AnalysisPickerProps = {
  accession: string;
  replicaName: string;
  analyses: readonly string[];
  current: string;
  // Variant labels from the backend; absent or partial lists fall back to labelOf.
  options?: readonly AnalysisOption[] | null;
};

// Selects look like the outline section buttons they sit beside; the parent supplies the flex-wrap row.
const TRIGGER_CLASS = cn(buttonVariants({ variant: "outline" }), "border-primary text-primary w-auto justify-between gap-2 px-6 max-sm:min-h-11");

const AnalysisPicker = ({ accession, replicaName, analyses, current, options }: AnalysisPickerProps) => {
  const router = useRouter();
  const groups = groupAnalyses(analyses);
  const currentGroup = groups.find((group) => group.variants.includes(current));
  const go = (name: string) => router.push(replicaHref(accession, replicaName, "analyses", name));
  const variantLabel = (name: string) => options?.find((option) => option.analysis === name)?.name || labelOf(name);

  return (
    <>
      <Select
        value={currentGroup?.baseId}
        onValueChange={(baseId) => {
          const target = groups.find((group) => group.baseId === baseId);
          if (target?.variants[0]) go(target.variants[0]);
        }}
      >
        <SelectTrigger aria-label="Analysis type" className={TRIGGER_CLASS}>
          <SelectValue placeholder="Select analysis" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.baseId} value={group.baseId}>
              {group.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentGroup?.hasVariants ? (
        <Select value={current} onValueChange={go}>
          <SelectTrigger aria-label="Variant" className={TRIGGER_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentGroup.variants.map((name) => (
              <SelectItem key={name} value={name}>
                {variantLabel(name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </>
  );
};

export { AnalysisPicker };
