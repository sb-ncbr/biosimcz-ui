"use client";

import { Badge, Button } from "@e-infra/design-system";
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { cn } from "@/shared/lib";
import { Icon } from "@/shared/ui/icons";
import { formatBytes } from "../lib/format";

type DropzoneProps = {
  accept: readonly string[];
  maxBytes: number;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
};

// Native input plus drag events; the design system has no file uploader. The "Select files" button is always
// present so dragging is never the only way in (WCAG 2.5.7).
const Dropzone = ({ accept, maxBytes, onFiles, disabled = false, className }: DropzoneProps) => {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  // dragenter/leave also fire for child elements; a depth counter keeps the highlight from flickering.
  const depth = useRef(0);

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    depth.current += 1;
    if (!disabled) setDragging(true);
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Reset so selecting the same file again still fires change.
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      data-dragging={dragging || undefined}
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "bg-surface/40 flex flex-col items-center gap-1.5 rounded-[10px] border border-dashed px-4 py-5.5 text-center",
        dragging ? "border-base-400 border-solid" : "border-border",
        className,
      )}
    >
      <span className="bg-background border-border mb-1 flex rounded-full border p-2" aria-hidden="true">
        <Icon name="upload-24" className="size-6" />
      </span>
      <p className="text-[13px]" aria-live="polite">
        {dragging ? (
          <span className="text-text font-medium">Drop files to upload</span>
        ) : (
          <>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-[13px] font-medium"
              disabled={disabled}
              aria-describedby={hintId}
              onClick={() => input.current?.click()}
            >
              Select files
            </Button>
            <span className="text-text-muted hidden md:inline"> or drop them here</span>
          </>
        )}
      </p>
      <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Accepted file types">
        {accept.map((ext) => (
          <li key={ext}>
            <Badge variant="outline" className="font-normal">
              {ext}
            </Badge>
          </li>
        ))}
      </ul>
      <p id={hintId} className="text-text-muted text-[11px]">
        Max file size: {formatBytes(maxBytes)}
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept.join(",")}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="dropzone-input"
        onChange={onChange}
      />
    </div>
  );
};

export { Dropzone };
export type { DropzoneProps };
