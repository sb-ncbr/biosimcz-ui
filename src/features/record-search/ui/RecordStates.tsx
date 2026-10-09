"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ACCESS_LABELS } from "@/entities/deposition";
import {
  recordsHref,
  type RecordSearchQuery,
  type RecordSourceCapabilities,
} from "@/entities/record";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  H3,
  Muted,
} from "@/shared/ui";
import {
  clearRecordFilters,
  facetValues,
  hasRecordFilters,
} from "../model/urlState";

const Panel = ({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <H3>{title}</H3>
    <Muted>{text}</Muted>
    {children ? (
      <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>
    ) : null}
  </div>
);

// The repository has no published records at all (and nothing was searched).
const NoRecords = ({ deposit }: { deposit?: ReactNode }) => (
  <Panel
    title="No simulations yet"
    text="Simulations appear here once they are published."
  >
    {deposit}
  </Panel>
);

const activeFilters = (
  query: RecordSearchQuery,
  capabilities: RecordSourceCapabilities,
): string[] =>
  capabilities.facets.flatMap((spec) =>
    facetValues(query, spec.name).map(
      (value) =>
        `${spec.title}: ${spec.name === "access" ? ((ACCESS_LABELS as Record<string, string>)[value] ?? value) : value}`,
    ),
  );

// Results are empty although the repository has records: say why and offer the way out (links, so no JS is needed).
const NoMatches = ({
  query,
  capabilities,
}: {
  query: RecordSearchQuery;
  capabilities: RecordSourceCapabilities;
}) => {
  const filtered = hasRecordFilters(query);
  const searching = query.q !== "";
  return (
    <Panel
      title="No records match"
      text="Check the spelling, try fewer or broader keywords, or remove a filter."
    >
      {filtered ? (
        <Button asChild variant="outline" size="sm">
          <Link href={recordsHref(clearRecordFilters(query))}>
            Clear filters
          </Link>
        </Button>
      ) : null}
      {searching ? (
        <Button asChild variant="outline" size="sm">
          <Link
            href={recordsHref({
              facets: query.facets,
              sort: query.sort,
              size: query.size,
            })}
          >
            Clear search
          </Link>
        </Button>
      ) : null}
      {filtered ? (
        <ul className="text-text-muted basis-full text-xs">
          {activeFilters(query, capabilities).map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
};

// error.tsx content. The app bar and the search form stay usable around it.
const RecordsError = ({
  digest,
  onRetry,
}: {
  digest?: string | undefined;
  onRetry: () => void;
}) => (
  <div className="max-w-160">
    <Alert variant="error" role="alert">
      <AlertTitle>We could not load records.</AlertTitle>
      <AlertDescription>Try again in a moment.</AlertDescription>
    </Alert>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
      {digest ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
              Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="text-text-muted mt-1 text-xs">
            Error code: {digest}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  </div>
);

export { NoMatches, NoRecords, RecordsError };
