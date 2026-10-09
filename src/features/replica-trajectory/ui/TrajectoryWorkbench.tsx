"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplicaDetail } from "@/entities/replica";
import { Alert, AlertDescription, Card, CardContent, Progress } from "@/shared/ui";
import { StructureViewer, structureUrlFor, trajectoryUrlFor, type ViewerCoordinates, type ViewerStatus } from "@/shared/viewers/molstar";
import { downloadTrajectory, TrajectoryDownloadError, type DownloadProgress } from "../model/download";
import { formatBytes } from "../model/formatBytes";
import { problemMessage } from "../model/messages";
import { useTrajectoryRequest, type TrajectoryInputs } from "../model/useTrajectoryRequest";
import { TrajectoryForm } from "./TrajectoryForm";

const VIEWER_HEIGHT = 700;
const SERVER_FIELD_MESSAGES = {
  frames: "The server did not accept this frame window. Use start:end:stride, counted from 1.",
  selection: "The server did not accept this selection.",
} as const;

type DownloadState =
  | { phase: "idle"; notice: string | null }
  | { phase: "loading"; progress: DownloadProgress }
  | { phase: "error"; message: string; fields: Partial<Record<keyof TrajectoryInputs, string>> };

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

const fieldMessages = (fieldErrors: Record<string, string> | undefined): Partial<Record<keyof TrajectoryInputs, string>> => {
  const fields: Partial<Record<keyof TrajectoryInputs, string>> = {};
  if (fieldErrors?.frames) fields.frames = SERVER_FIELD_MESSAGES.frames;
  if (fieldErrors?.selection) fields.selection = SERVER_FIELD_MESSAGES.selection;
  return fields;
};

const DownloadOverlay = ({ progress }: { progress: DownloadProgress }) => {
  const percent = progress.totalBytes ? Math.min(100, Math.round((progress.receivedBytes / progress.totalBytes) * 100)) : null;
  return (
    <div className="bg-surface/90 border-border absolute inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-lg border p-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>Downloading frames</span>
        <span className="text-text-muted tabular-nums">
          {formatBytes(progress.receivedBytes)}
          {progress.totalBytes ? ` of ${formatBytes(progress.totalBytes)} (${percent}%)` : ""}
        </span>
      </div>
      <Progress value={percent} aria-label="Trajectory download progress" />
    </div>
  );
};

const statusLine = (viewer: ViewerStatus, download: DownloadState, hasFrames: boolean): string => {
  if (download.phase === "loading") return "Downloading frames.";
  if (viewer === "error") return "Structure unavailable. Check the selection, or use Try again in the viewer.";
  if (viewer === "loading") return "Loading structure.";
  if (viewer === "ready" && hasFrames) return "Trajectory loaded. Use the player controls in the viewer.";
  if (viewer === "ready") return "Structure loaded. Load a frame window to play the trajectory.";
  return "";
};

const TrajectoryWorkbench = ({ replica }: { replica: ReplicaDetail }) => {
  const { request, commit } = useTrajectoryRequest();
  const [download, setDownload] = useState<DownloadState>({ phase: "idle", notice: null });
  const [coordinates, setCoordinates] = useState<ViewerCoordinates | null>(null);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(
    async (inputs: TrajectoryInputs) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      commit(inputs);
      setCoordinates(null);
      setDownload({ phase: "loading", progress: { receivedBytes: 0, totalBytes: null } });
      const url = trajectoryUrlFor(replica.instanceId, {
        frames: inputs.frames === "" ? undefined : inputs.frames,
        selection: inputs.selection === "" ? undefined : inputs.selection,
      });
      try {
        const data = await downloadTrajectory(url, {
          signal: controller.signal,
          onProgress: (progress) => {
            if (!controller.signal.aborted) setDownload({ phase: "loading", progress });
          },
        });
        if (controller.signal.aborted) return;
        setCoordinates({ data, format: "xtc" });
        setDownload({ phase: "idle", notice: null });
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof TrajectoryDownloadError) {
          setDownload({
            phase: "error",
            message: problemMessage(error.problem, error.retryAfterSeconds),
            fields: error.problem.status === 422 ? fieldMessages(error.problem.fieldErrors) : {},
          });
        } else {
          setDownload({ phase: "error", message: problemMessage({ kind: "network", messageKey: "errors.network" }), fields: {} });
        }
      }
    },
    [commit, replica.instanceId],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setDownload({ phase: "idle", notice: "Download cancelled." });
  }, []);

  const structureUrl = structureUrlFor(replica.instanceId, request.selection === "" ? undefined : request.selection);
  const busy = download.phase === "loading";
  const message = statusLine(viewerStatus, download, coordinates !== null);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0 justify-start">
        <CardContent className="flex flex-col gap-4">
          <TrajectoryForm
            initialValues={request}
            atoms={replica.atoms}
            totalFrames={replica.frames}
            busy={busy}
            onSubmit={(inputs) => void start(inputs)}
            onCancel={cancel}
            serverFieldErrors={download.phase === "error" ? download.fields : undefined}
          />
          {download.phase === "error" ? (
            <Alert variant="error" role="alert">
              <AlertDescription>{download.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      <Card className="min-w-0 justify-start gap-3 py-3">
        <CardContent className="flex min-w-0 flex-col gap-2 px-3">
          <div className="relative min-w-0">
            <StructureViewer
              structureUrl={structureUrl}
              coordinates={coordinates ?? undefined}
              title={`${replica.name} trajectory`}
              variant="full"
              height={VIEWER_HEIGHT}
              onStatus={setViewerStatus}
            />
            {download.phase === "loading" ? <DownloadOverlay progress={download.progress} /> : null}
          </div>
          <p role="status" aria-live="polite" className="text-text-muted min-h-5 text-sm">
            {download.phase === "idle" && download.notice ? download.notice : message}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export { TrajectoryWorkbench };
