"use client";

import Link from "next/link";
import { draftHref, type DepositionDraft, type RunResult, type StepResult } from "@/entities/deposition";
import { DefinitionList, StepSummary } from "@/entities/deposition/ui";
import { cellText, summarizeRun, type Cell } from "@/features/step-experiments";
import { ROLE_LABEL, roleFromName } from "@/features/upload";
import { enableShowRequired } from "@/shared/lib/showRequired";
import { Badge, CountBadge, Muted, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui";
import { ItemRow, MissingValue } from "./values";
import type { MissingLookup } from "../model/problems";

type ExperimentsSummaryProps = { draftId: string; draft: DepositionDraft; result: StepResult; find: MissingLookup };

const runName = (name: string | undefined): string => name?.trim() || "Unnamed run";

const CellValue = ({ cell }: { cell: Cell }) => {
  if (cell.kind === "missing") return <span className="text-text-muted italic">missing</span>;
  if (cell.kind === "na") return <span className="text-text-muted" aria-label="Not applicable">-</span>;
  return <>{cell.text}</>;
};

const Pill = ({ result }: { result: RunResult | undefined }) => {
  if (!result) return null;
  if (result.toFix > 0) return <Badge variant="error" className="text-[11px]">{result.toFix} to fix</Badge>;
  return <CountBadge count={result.requiredLeft} />;
};

// Read-only compact table (226:5484): no grip, no menu. Below md it becomes a stacked list (missing-states 7.3).
const ExperimentsSummary = ({ draftId, draft, result, find }: ExperimentsSummaryProps) => {
  const runs = draft.runs;
  const results = new Map(result.runs.map((item) => [item.id, item]));
  const noRuns = find("experiments", "runs");
  const withFiles = runs.filter((run) => run.fileKeys.length > 0);
  // Two unnamed runs would collide as list terms, so repeated names get their position.
  const fileTerms = withFiles.map((run, index, all) =>
    all.filter((other) => runName(other.name) === runName(run.name)).length > 1 ? `${runName(run.name)} (${index + 1})` : runName(run.name),
  );

  return (
    <StepSummary
      id="review-experiments"
      title={result.title}
      status={result.status}
      requiredLeft={result.requiredLeft}
      toFix={result.toFix}
      editHref={draftHref(draftId, "experiments")}
    >
      {runs.length === 0 ? (
        <div className="flex flex-col gap-1.5 pb-2">
          {noRuns ? <MissingValue draftId={draftId} field={noRuns} /> : <Muted>No runs.</Muted>}
          <Muted className="text-xs">Add each run of your protocol, for example minimization, equilibration and production.</Muted>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6">#</TableHead>
                  <TableHead>Run</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-[72px] text-center">Ensemble</TableHead>
                  <TableHead className="w-24">Length</TableHead>
                  <TableHead className="w-14">Temp</TableHead>
                  <TableHead className="w-[68px]">Pressure</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Required</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run, index) => {
                  const summary = summarizeRun(run);
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="text-text-muted">{index + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={draftHref(draftId, "experiments", run.id)}
                          className="text-text focus-visible:ring-border-focus rounded-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2"
                        >
                          {runName(run.name)}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {summary.typeLabel ?? <span className="text-text-muted italic">missing</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {summary.ensemble ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {summary.ensemble}
                          </Badge>
                        ) : (
                          <span className="text-text-muted" aria-label="Not applicable">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <CellValue cell={summary.length} />
                      </TableCell>
                      <TableCell>
                        <CellValue cell={summary.temperature} />
                      </TableCell>
                      <TableCell>
                        <CellValue cell={summary.pressure} />
                      </TableCell>
                      <TableCell>
                        <Pill result={results.get(run.id)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul aria-label="Runs" className="flex flex-col gap-2 md:hidden">
            {runs.map((run) => {
              const summary = summarizeRun(run);
              const facts = [
                summary.typeLabel,
                summary.ensemble,
                summary.length.kind === "na" ? null : summary.length.kind === "missing" ? "Length missing" : cellText(summary.length),
                summary.temperature.kind === "value" ? cellText(summary.temperature) : null,
                summary.pressure.kind === "value" ? cellText(summary.pressure) : null,
              ].filter(Boolean);
              return (
                <li key={run.id} className="border-border flex flex-col gap-1 rounded-lg border px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href={draftHref(draftId, "experiments", run.id)}
                      onClick={() => enableShowRequired(draftId)}
                      className="text-text min-w-0 flex-1 truncate text-sm font-medium"
                    >
                      {runName(run.name)}
                    </Link>
                    <Pill result={results.get(run.id)} />
                  </div>
                  <Muted className="text-xs">{facts.join(" - ")}</Muted>
                </li>
              );
            })}
          </ul>

          {withFiles.length > 0 ? (
            <div role="group" aria-label="Files" className="flex flex-col gap-1 pt-2">
              <p className="text-text-muted text-xs font-semibold" aria-hidden="true">
                Files
              </p>
              <DefinitionList
                items={withFiles.map((run, index) => ({
                  term: fileTerms[index] ?? runName(run.name),
                  description: run.fileKeys.map((key) => <ItemRow key={key} title={key} sub={ROLE_LABEL[roleFromName(key)]} />),
                }))}
              />
            </div>
          ) : null}
        </>
      )}
    </StepSummary>
  );
};

export { ExperimentsSummary };
