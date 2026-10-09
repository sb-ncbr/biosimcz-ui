"use client";

import { Suspense, type ReactNode } from "react";
import { analysisDataUrl, labelOf } from "@/entities/analysis";
import { Alert, AlertDescription, AlertTitle, Button, Card, Separator } from "@/shared/ui";
import { ChartSkeleton } from "@/shared/viewers/echarts";
import { resolveRenderer, type PanelContext } from "../model/registry";
import { useAnalysis } from "../model/useAnalysis";
import { PanelBoundary } from "./PanelBoundary";

// Final chart height, so the skeleton and the loaded panel occupy the same space.
const ANALYSIS_PANEL_HEIGHT = 420;

type AnalysisViewProps = { instanceId: string; analysisName: string; frameStepNs?: number | null; atoms?: number | null };

// Instance ids are "<accession>.<replica number>"; the footer shows them the way the old UI did.
const splitInstanceId = (instanceId: string): { project: string; replica: string | null } => {
  const dot = instanceId.lastIndexOf(".");
  return dot > 0 ? { project: instanceId.slice(0, dot), replica: instanceId.slice(dot + 1) } : { project: instanceId, replica: null };
};

const AnalysisCard = ({ instanceId, analysisName, children }: { instanceId: string; analysisName: string; children: ReactNode }) => {
  const { project, replica } = splitInstanceId(instanceId);
  return (
    <Card className="flex flex-col gap-3 p-4">
      {children}
      <Separator />
      <div className="text-text-muted flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {`Project: ${project}`}
          {replica ? ` · Replica: ${replica}` : ""}
          {` · Analysis: ${analysisName}`}
        </span>
        <Button asChild variant="outline" size="sm">
          <a href={analysisDataUrl(instanceId, analysisName)} download={`${analysisName}.json`}>
            Download JSON
          </a>
        </Button>
      </div>
    </Card>
  );
};

const AnalysisView = ({ instanceId, analysisName, frameStepNs = null, atoms = null }: AnalysisViewProps) => {
  const resolved = resolveRenderer(analysisName);
  const query = useAnalysis(instanceId, analysisName, resolved?.entry ?? null);
  const card = (children: ReactNode) => (
    <AnalysisCard instanceId={instanceId} analysisName={analysisName}>
      {children}
    </AnalysisCard>
  );

  if (!resolved) {
    return card(
      <Alert>
        <AlertTitle>Preview not available</AlertTitle>
        <AlertDescription>{labelOf(analysisName)} has no built-in view yet. The raw data is still available.</AlertDescription>
      </Alert>,
    );
  }

  if (query.isPending) return card(<ChartSkeleton height={ANALYSIS_PANEL_HEIGHT} />);

  if (query.isError) {
    return card(
      <Alert variant="error" role="alert">
        <AlertTitle>Could not load this analysis</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          The data request failed. Check the connection and try again.
          <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>,
    );
  }

  const parsed = query.data;
  if (!parsed.ok) {
    const where = parsed.issue.path ? ` (at ${parsed.issue.path})` : "";
    return card(
      <Alert variant="warning">
        <AlertTitle>Data shape not recognised</AlertTitle>
        <AlertDescription>{`This analysis does not match the expected format${where}.`}</AlertDescription>
      </Alert>,
    );
  }

  const { Panel, config } = resolved.entry;
  const context: PanelContext = { instanceId, analysisName, frameStepNs, atoms };
  return card(
    <PanelBoundary height={ANALYSIS_PANEL_HEIGHT}>
      <Suspense fallback={<ChartSkeleton height={ANALYSIS_PANEL_HEIGHT} />}>
        <Panel data={parsed.data} context={context} {...(config ? { config } : {})} />
      </Suspense>
    </PanelBoundary>,
  );
};

export { ANALYSIS_PANEL_HEIGHT, AnalysisView };
