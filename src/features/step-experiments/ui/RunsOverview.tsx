"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { draftHref, type Run, type RunResult } from "@/entities/deposition";
import { StepStatusIcon } from "@/entities/deposition/ui";
import { useDraft } from "@/features/draft";
import { Badge, CountBadge, H3, Muted, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui";
import { cellText, summarizeRun, type Cell } from "../lib/runs";
import { useRunActions } from "../model/useRunActions";
import { AddRunMenu } from "./AddRunMenu";
import { DeleteRunDialog } from "./DeleteRunDialog";
import { RunMenu } from "./RunMenu";

const NotApplicable = () => (
  <span className="text-text-muted" aria-label="Not applicable">
    -
  </span>
);

const CellText = ({ cell }: { cell: Cell }) => {
  if (cell.kind === "missing") return <span className="text-text-muted italic">missing</span>;
  if (cell.kind === "na") return <NotApplicable />;
  return <>{cell.text}</>;
};

const RunPill = ({ result }: { result: RunResult | undefined }) => {
  if (!result) return null;
  if (result.toFix > 0) {
    return (
      <Badge variant="error" className="text-[11px]">
        {result.toFix} to fix
      </Badge>
    );
  }
  return <CountBadge count={result.requiredLeft} />;
};

const runName = (run: Run): string => run.name?.trim() || "Unnamed run";

// Step 3 landing (186:1099): the runs in the order they ran, with the "Add run" type menu. Below md the table becomes a
// stacked list (missing-states 7.3).
const RunsOverview = () => {
  const { draftId, draft, completeness } = useDraft();
  const actions = useRunActions();
  const [deleting, setDeleting] = useState<Run | null>(null);
  const results = useMemo(
    () => new Map((completeness.steps.find((step) => step.id === "experiments")?.runs ?? []).map((result) => [result.id, result])),
    [completeness],
  );
  const { runs } = draft;

  const menu = (run: Run, index: number) => (
    <RunMenu
      draftId={draftId}
      run={run}
      name={runName(run)}
      isFirst={index === 0}
      isLast={index === runs.length - 1}
      onDuplicate={actions.duplicate}
      onMove={actions.move}
      onDelete={setDeleting}
    />
  );

  return (
    <>
      {runs.length === 0 ? (
        <section aria-label="No runs yet" className="border-border flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-6">
          <H3>No runs yet</H3>
          <Muted>
            Add each run of your simulation protocol in the order it ran, for example minimization, equilibration and production.
          </Muted>
          <AddRunMenu onAdd={actions.addRun} />
        </section>
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
                  <TableHead className="w-9">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run, index) => {
                  const summary = summarizeRun(run);
                  const result = results.get(run.id);
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="text-text-muted">{index + 1}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <StepStatusIcon status={result?.status ?? "todo"} size={14} />
                          <Link
                            href={draftHref(draftId, "experiments", run.id)}
                            className="text-text focus-visible:ring-border-focus rounded-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2"
                          >
                            {runName(run)}
                          </Link>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal">{summary.typeLabel ?? <span className="text-text-muted italic">missing</span>}</TableCell>
                      <TableCell className="text-center">
                        {summary.ensemble ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {summary.ensemble}
                          </Badge>
                        ) : (
                          <NotApplicable />
                        )}
                      </TableCell>
                      <TableCell>
                        <CellText cell={summary.length} />
                      </TableCell>
                      <TableCell>
                        <CellText cell={summary.temperature} />
                      </TableCell>
                      <TableCell>
                        <CellText cell={summary.pressure} />
                      </TableCell>
                      <TableCell>
                        <RunPill result={result} />
                      </TableCell>
                      <TableCell>{menu(run, index)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul aria-label="Runs" className="flex flex-col gap-2 md:hidden">
            {runs.map((run, index) => {
              const summary = summarizeRun(run);
              const result = results.get(run.id);
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
                    <StepStatusIcon status={result?.status ?? "todo"} size={14} />
                    <Link href={draftHref(draftId, "experiments", run.id)} className="text-text min-w-0 flex-1 truncate text-sm font-medium">
                      {runName(run)}
                    </Link>
                    <RunPill result={result} />
                    {menu(run, index)}
                  </div>
                  <Muted className="text-xs">{facts.join(" - ")}</Muted>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <DeleteRunDialog
        run={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={(run) => {
          actions.remove(run);
          setDeleting(null);
        }}
      />
    </>
  );
};

export { RunsOverview };
