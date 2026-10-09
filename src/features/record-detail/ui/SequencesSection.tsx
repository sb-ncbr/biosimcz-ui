"use client";

import { useId, useState } from "react";
import type { RecordSequence } from "@/entities/record";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { residueBlocks } from "../lib/format";
import { CopyButton } from "./CopyButton";
import { RecordSection } from "./RecordSection";

// Past this many residues the block starts clamped to a few lines.
const LONG_SEQUENCE = 300;

const KIND_LABEL: Record<RecordSequence["kind"], string> = { protein: "Protein", nucleic: "Nucleic acid" };

const SequenceBlock = ({ sequence, label }: { sequence: RecordSequence; label: string }) => {
  const long = sequence.sequence.length > LONG_SEQUENCE;
  const [expanded, setExpanded] = useState(false);
  const blockId = useId();
  const residues = sequence.sequence.length.toLocaleString("en");
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-text-muted">
          {KIND_LABEL[sequence.kind]} · {residues} residues
        </span>
        <span className="flex-1" />
        <CopyButton text={sequence.sequence} what={label.toLowerCase()} />
      </figcaption>
      <pre
        id={blockId}
        className={cn(
          "bg-base-50 border-border/60 rounded-md border p-3 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap",
          long && !expanded && "max-h-24 overflow-hidden",
        )}
      >
        {residueBlocks(sequence.sequence)}
      </pre>
      {long ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          aria-expanded={expanded}
          aria-controls={blockId}
          onClick={() => setExpanded((value) => !value)}
          className="h-auto self-start p-0 text-xs max-md:min-h-11"
        >
          {expanded ? "Show less" : `Show all ${residues} residues`}
        </Button>
      ) : null}
    </figure>
  );
};

const SequencesSection = ({ sequences }: { sequences: RecordSequence[] }) => {
  if (sequences.length === 0) return null;
  return (
    <RecordSection id="sequences" title="Sequences" count={sequences.length}>
      {sequences.map((sequence, index) => (
        <SequenceBlock key={index} sequence={sequence} label={`Sequence ${index + 1}`} />
      ))}
    </RecordSection>
  );
};

export { SequencesSection };
