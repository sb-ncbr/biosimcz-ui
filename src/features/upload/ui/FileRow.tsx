"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Progress,
  buttonVariants,
} from "@e-infra/design-system";
import { CircleAlert, LoaderCircle, X } from "lucide-react";
import { useRef, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib";
import { ROLE_LABEL } from "../lib/fileRole";
import { formatBytes, formatProgress } from "../lib/format";
import { extensionOf } from "../lib/keys";
import type { UploadItem } from "../model/uploadMachine";

type FileRowProps = {
  item: UploadItem;
  accept: readonly string[];
  maxBytes: number;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onResume: (id: string, file: File) => void;
  // Shown on an unreadable file (missing-states 3.5); omitted = no action.
  onReplace?: (id: string, file: File) => void;
  // "Reading composition..." for system files, "Reading run parameters..." for experiment files.
  parsingLabel?: string;
  className?: string;
};

const rejectionText = (item: UploadItem, accept: readonly string[], maxBytes: number): string => {
  switch (item.rejectReason) {
    case "too_large":
      return `${item.name} is ${formatBytes(item.size)}. The limit is ${formatBytes(maxBytes)} per file.`;
    case "type": {
      const ext = extensionOf(item.name);
      const list = accept.join(", ").replace(/, ([^,]*)$/, " or $1");
      return `${ext ? `${ext} files are` : "Files without an extension are"} not accepted here. Use ${list}.`;
    }
    case "duplicate":
      return `A file named ${item.name} is already in this deposition.`;
    default:
      return "This file name cannot be used. Rename the file and try again.";
  }
};

type Presentation = { text: string; tone?: "error"; trailing?: "spinner" | "retry" | "select" | "remove-only" | "none" };

const present = (item: UploadItem, props: Pick<FileRowProps, "accept" | "maxBytes" | "parsingLabel">): Presentation => {
  switch (item.status) {
    case "queued":
      return { text: "Waiting to upload" };
    case "initiating":
    case "uploading":
      return { text: `Uploading - ${formatProgress(item.loaded, item.size)}` };
    case "committing":
      return { text: "Finishing upload...", trailing: "spinner" };
    case "parsing":
      return { text: props.parsingLabel ?? "Reading composition...", trailing: "spinner" };
    case "done":
      return item.parse?.status === "unreadable"
        ? { text: "Could not be read", tone: "error" }
        : { text: ROLE_LABEL[item.role] };
    case "failed":
      return item.failReason === "rejected"
        ? { text: "The server did not accept this file. It may be larger than allowed.", tone: "error", trailing: "remove-only" }
        : { text: "Upload failed. Check your connection and try again.", tone: "error", trailing: "retry" };
    case "paused":
      return { text: "Paused - waiting for connection" };
    case "interrupted":
      return item.resumeMismatch
        ? {
            text: `This is a different file. Select ${item.name}${item.size > 0 ? ` (${formatBytes(item.size)})` : ""}, or remove this row.`,
            tone: "error",
            trailing: "select",
          }
        : { text: "Upload interrupted. Select the file again to continue.", tone: "error", trailing: "select" };
    case "removing":
      return { text: "Removing...", trailing: "spinner" };
    case "remove_failed":
      return { text: "Could not remove the file. Try again.", tone: "error", trailing: "retry" };
    case "rejected":
      return { text: rejectionText(item, props.accept, props.maxBytes), tone: "error", trailing: "remove-only" };
  }
};

const FileRow = ({ item, accept, maxBytes, onRetry, onRemove, onResume, onReplace, parsingLabel, className }: FileRowProps) => {
  const picker = useRef<HTMLInputElement>(null);
  const replacer = useRef<HTMLInputElement>(null);
  const view = present(item, { accept, maxBytes, parsingLabel });
  const uploading = item.status === "initiating" || item.status === "uploading";
  const ext = extensionOf(item.name).slice(1, 4).toUpperCase();
  const confirmRemove = item.status === "done" && (item.parse?.fields.length ?? 0) > 0;
  const size = item.size > 0 ? formatBytes(item.size) : "";

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onResume(item.id, file);
  };

  const onReplacePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onReplace?.(item.id, file);
  };

  const removeButton: ReactNode = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Remove ${item.name}`}
      disabled={item.status === "removing"}
      onClick={confirmRemove ? undefined : () => onRemove(item.id)}
    >
      <X className="size-4" aria-hidden="true" />
    </Button>
  );

  return (
    <li
      data-status={item.status}
      className={cn(
        "border-border flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border px-2.5 py-2",
        item.status === "removing" && "opacity-60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-surface text-text-muted flex size-7 shrink-0 items-center justify-center rounded-md text-[9px] font-bold"
      >
        {ext}
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <p className="text-text truncate text-[13px] leading-4 font-medium">{item.name}</p>
        <p className={cn("text-[11px] leading-4", view.tone === "error" ? "text-error-700" : "text-text-muted")}>{view.text}</p>
        {uploading ? (
          <Progress
            value={item.size > 0 ? Math.round((item.loaded / item.size) * 100) : 0}
            aria-label={`Uploading ${item.name}`}
            aria-valuetext={formatProgress(item.loaded, item.size)}
            className="mt-1.5 h-1"
          />
        ) : null}
      </div>

      {size && item.status !== "rejected" ? <span className="text-text-muted shrink-0 text-[11px]">{size}</span> : null}

      {item.status === "done" && item.parse?.status === "unreadable" ? (
        <CircleAlert className="text-error-700 size-4 shrink-0" role="img" aria-label="Could not be read" />
      ) : null}

      {item.status === "done" && item.parse?.status === "unreadable" && onReplace ? (
        <>
          <input
            ref={replacer}
            type="file"
            accept={accept.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="replace-input"
            onChange={onReplacePick}
          />
          <Button type="button" variant="outline" size="sm" aria-label={`Replace ${item.name}`} onClick={() => replacer.current?.click()}>
            Replace file
          </Button>
        </>
      ) : null}

      {view.trailing === "spinner" ? (
        <LoaderCircle className="text-text-muted size-4 shrink-0 animate-spin motion-reduce:animate-none" role="img" aria-label="In progress" />
      ) : null}

      {view.trailing === "retry" ? (
        <Button type="button" variant="outline" size="sm" onClick={() => (item.status === "remove_failed" ? onRemove(item.id) : onRetry(item.id))}>
          Retry
        </Button>
      ) : null}

      {view.trailing === "select" ? (
        <>
          <input
            ref={picker}
            type="file"
            accept={accept.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPick}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()}>
            Select file
          </Button>
        </>
      ) : null}

      {item.status !== "removing" && item.status !== "committing" && item.status !== "parsing" ? (
        confirmRemove ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>{removeButton}</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {item.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Fields filled in from this file stay as they are. You can change them below.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className={buttonVariants({ variant: "error" })} onClick={() => onRemove(item.id)}>
                  Remove file
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          removeButton
        )
      ) : null}
    </li>
  );
};

export { FileRow };
export type { FileRowProps };
