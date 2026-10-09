"use client";

import { useState } from "react";
import { formatDay } from "@/entities/deposition";
import type { RecordDetail } from "@/entities/record";
import { Button, Muted, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui";
import { fileType } from "../lib/format";
import { formatFileSize } from "../lib/formatFileSize";
import { RecordSection } from "./RecordSection";

const VISIBLE_FILES = 10;

type FilesSectionProps = Pick<RecordDetail, "files" | "access" | "embargoUntil">;

// Names only: MDposit lists no sizes and no BFF download route exists yet, so nothing here pretends to be downloadable.
const FilesSection = ({ files, access, embargoUntil }: FilesSectionProps) => {
  const [expanded, setExpanded] = useState(false);

  if (files === null) {
    // The backend returns no list for an anonymous caller of an embargoed or restricted record.
    const note = access === "embargoed" && embargoUntil ? `Files are available after ${formatDay(embargoUntil)}.` : "Files are restricted.";
    return (
      <RecordSection id="files" title="Files">
        <Muted>{note}</Muted>
      </RecordSection>
    );
  }
  if (files.length === 0) return null;

  const showSize = files.some((file) => file.size !== null);
  const shown = expanded ? files : files.slice(0, VISIBLE_FILES);
  const hidden = files.length - VISIBLE_FILES;
  return (
    <RecordSection id="files" title="Files" count={files.length}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-20">Type</TableHead>
            {showSize ? <TableHead className="w-24 text-right">Size</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((file) => (
            <TableRow key={file.key}>
              <TableCell className="font-mono text-xs break-all whitespace-normal">{file.key}</TableCell>
              <TableCell className="text-text-muted text-xs">{fileType(file.key) ?? ""}</TableCell>
              {showSize ? (
                <TableCell className="text-right text-xs whitespace-nowrap tabular-nums">{file.size === null ? "" : formatFileSize(file.size)}</TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hidden > 0 ? (
        <Button type="button" variant="outline" size="sm" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="self-start max-md:min-h-11">
          {expanded ? "Show fewer files" : `Show all ${files.length} files`}
        </Button>
      ) : null}
    </RecordSection>
  );
};

export { FilesSection };
