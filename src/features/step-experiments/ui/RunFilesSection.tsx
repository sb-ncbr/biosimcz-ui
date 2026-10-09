"use client";

import { CircleAlert, Plus } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { fieldAnchor, type SectionResult } from "@/entities/deposition";
import { useStepContext } from "@/entities/deposition/ui";
import { FormSection } from "@/entities/deposition/ui";
import { Dropzone, UploadFileList, type UseUploads } from "@/features/upload";
import { cn } from "@/shared/lib";
import { REQUIRED_COPY } from "../lib/messages";

type RunFilesSectionProps = {
  result: SectionResult | undefined;
  uploads: UseUploads;
};

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? "" : "s"}`;

const metaFor = (summary: UseUploads["summary"]): string | undefined => {
  if (summary.paused > 0) return "Paused";
  if (summary.failed > 0) return `${summary.failed} failed`;
  if (summary.inFlight > 0) return `${summary.uploaded} of ${summary.total} uploaded`;
  if (summary.total > 0) return plural(summary.total, "file");
  return undefined;
};

// "Experiment files" (191:283): same dropzone and rows as System files, scoped to this run.
const RunFilesSection = ({ result, uploads }: RunFilesSectionProps) => {
  const { items, summary, accept, maxBytes, addFiles } = uploads;
  const { showRequired, missing } = useStepContext();
  const picker = useRef<HTMLInputElement>(null);
  const visible = items.length > 0;
  const requiredMessage = showRequired && missing.has("fileKeys") && !visible ? REQUIRED_COPY["fileKeys"] : undefined;

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length > 0) addFiles(selected);
  };

  return (
    <FormSection id="files" title="Experiment files" description="Parameters and output files for this run." result={result} meta={metaFor(summary)}>
      <div id={fieldAnchor("files", "fileKeys")} className="scroll-mt-24 flex flex-col gap-2">
        {visible ? (
          <>
            <UploadFileList uploads={uploads} />
            <div className="border-border flex items-center gap-2 rounded-[10px] border border-dashed px-3 py-2.5">
              <input
                ref={picker}
                type="file"
                multiple
                accept={accept.join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                data-testid="add-files-input"
                onChange={onPick}
              />
              <button
                type="button"
                onClick={() => picker.current?.click()}
                className="text-primary focus-visible:ring-border-focus flex items-center gap-2 rounded-sm text-xs font-medium outline-none focus-visible:ring-2"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add more files
              </button>
              <span className="text-text-muted ml-auto text-[11px]">{accept.join(" ")}</span>
            </div>
          </>
        ) : (
          <Dropzone accept={accept} maxBytes={maxBytes} onFiles={addFiles} className={cn(requiredMessage && "border-error")} />
        )}
        {requiredMessage ? (
          <p className="text-error-700 flex items-start gap-1 text-[12px] leading-4">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {requiredMessage}
          </p>
        ) : null}
        <p className="text-text-muted text-[11px] leading-4">
          {summary.inFlight > 0
            ? "You can keep filling in the form while files upload."
            : "Add the parameter and output files of this run. System files belong to Molecular system."}
        </p>
      </div>
    </FormSection>
  );
};

export { RunFilesSection };
export type { RunFilesSectionProps };
