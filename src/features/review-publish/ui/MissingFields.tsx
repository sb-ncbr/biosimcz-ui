"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Icon } from "@/shared/ui";
import { enableShowRequired } from "@/shared/lib/showRequired";
import { onReviewFocusRequest, takeReviewFocus } from "../model/focusRequest";
import type { ProblemRow } from "../model/problems";

const VISIBLE_ROWS = 8;

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? "" : "s"}`;

type MissingFieldsProps = {
  draftId: string;
  rows: ProblemRow[];
  requiredLeft: number;
  toFix: number;
  // Rows came from a failed server check instead of the local rules (missing-states 6.4).
  fromServer?: boolean;
  // Files are still uploading although every field is fine: Publish waits.
  uploading?: boolean;
};

const titleOf = ({ rows, requiredLeft, toFix, fromServer }: Pick<MissingFieldsProps, "rows" | "requiredLeft" | "toFix" | "fromServer">): string => {
  if (fromServer) return `The server found ${plural(rows.length, "problem")}`;
  if (requiredLeft > 0) return `${plural(requiredLeft, "required field")} left`;
  if (toFix > 0) return `${plural(toFix, "field")} to fix`;
  return "Some files need attention";
};

// The error summary of Review (226:6178, missing-states 3.4, 5.5). After a blocked Publish click it takes focus and is
// announced once; it is a plain region otherwise so it does not chatter on every edit.
const MissingFields = ({ draftId, rows, requiredLeft, toFix, fromServer, uploading }: MissingFieldsProps) => {
  const headingId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [announce, setAnnounce] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const consume = () => {
      if (!takeReviewFocus()) return;
      setAnnounce(true);
      // Effects run after the router has placed its own focus, so this wins; no frame wait needed.
      ref.current?.focus();
    };
    consume();
    return onReviewFocusRequest(consume);
  }, []);

  // The wrapper is the focus target in every variant, so a blocked Publish click always lands here.
  const frame = (children: ReactNode) => (
    <div ref={ref} tabIndex={-1} className="focus-visible:ring-border-focus rounded-lg outline-none focus-visible:ring-2">
      {children}
    </div>
  );

  if (rows.length === 0) {
    return frame(
      <>
        {uploading ? (
          <Alert variant="warning" role={announce ? "alert" : undefined}>
            <AlertTitle>Files are still uploading</AlertTitle>
            <AlertDescription>Publish is available when they finish.</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="success" role={announce ? "alert" : undefined}>
            <AlertTitle>Everything required is filled in</AlertTitle>
            <AlertDescription>Check the summary below, then publish.</AlertDescription>
          </Alert>
        )}
      </>,
    );
  }

  const shown = showAll ? rows : rows.slice(0, VISIBLE_ROWS);
  return frame(
    <section
      role={announce ? "alert" : undefined}
      aria-labelledby={headingId}
      className="border-border flex flex-col rounded-lg border px-4 pt-3.5 pb-2.5"
    >
      <div className="flex items-center gap-2">
        <Icon name="ring-14-missing" className="text-error-700 size-3.5" />
        <h2 id={headingId} className="text-sm font-semibold">
          {titleOf({ rows, requiredLeft, toFix, fromServer })}
        </h2>
      </div>
      <p className="text-text-muted text-xs">
        {fromServer ? "Check these and publish again." : "Fill them in before you can publish."}
        {!fromServer && requiredLeft > 0 && toFix > 0 ? ` ${plural(toFix, "field")} need fixing.` : ""}
      </p>
      <ul className="mt-2 flex flex-col">
        {shown.map((row) => (
          <li key={row.key} className="border-border flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t py-2 first:mt-0 max-md:flex-col">
            <span className="text-[13px] font-medium">{row.label}</span>
            <span className="text-text-muted text-xs">{row.location}</span>
            <span className="flex-1 max-md:hidden" />
            <Link
              href={row.href}
              onClick={() => enableShowRequired(draftId)}
              className="text-text focus-visible:ring-border-focus rounded-sm text-xs font-medium underline underline-offset-2 outline-none focus-visible:ring-2 max-md:flex max-md:min-h-11 max-md:w-full max-md:items-center"
            >
              {row.action} <span aria-hidden="true">&rarr;</span>
              <span className="sr-only">: {row.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > VISIBLE_ROWS && !showAll ? (
        <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setShowAll(true)}>
          Show all {rows.length}
        </Button>
      ) : null}
    </section>,
  );
};

export { MissingFields };
export type { MissingFieldsProps };
