"use client";

import { Alert, AlertDescription, Button } from "@e-infra/design-system";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib";
import type { UseUploads } from "../model/useUploads";
import { FileRow } from "./FileRow";

type UploadFileListProps = {
  uploads: UseUploads;
  parsingLabel?: string;
  className?: string;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Rows plus the batch-level pieces: "Retry all" alert and one polite announcement per finished batch.
const UploadFileList = ({ uploads, parsingLabel, className }: UploadFileListProps) => {
  const { items, summary, retry, retryAll, remove, resume, replace, accept, maxBytes } = uploads;
  const [announcement, setAnnouncement] = useState("");
  const wasActive = useRef(false);

  useEffect(() => {
    const active = summary.inFlight > 0;
    if (wasActive.current && !active) {
      const parts = [];
      if (summary.uploaded > 0) parts.push(`${plural(summary.uploaded, "file", "files")} uploaded`);
      if (summary.failed > 0) parts.push(`${plural(summary.failed, "upload", "uploads")} failed`);
      setAnnouncement(parts.join(", "));
    }
    wasActive.current = active;
  }, [summary]);

  if (items.length === 0) return <p role="status" className="sr-only">{announcement}</p>;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul aria-label="Files" className="flex flex-col gap-2">
        {items.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            accept={accept}
            maxBytes={maxBytes}
            parsingLabel={parsingLabel}
            onRetry={retry}
            onRemove={remove}
            onResume={resume}
            onReplace={replace}
          />
        ))}
      </ul>
      {summary.failed >= 2 ? (
        <Alert variant="error" className="flex items-center justify-between gap-3">
          <AlertDescription>{summary.failed} files did not upload.</AlertDescription>
          <Button type="button" size="sm" variant="outline" onClick={retryAll}>
            Retry all
          </Button>
        </Alert>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
};

export { UploadFileList };
export type { UploadFileListProps };
