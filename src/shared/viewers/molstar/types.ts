type ViewerStatus = "idle" | "loading" | "ready" | "error";

type ViewerStatusInfo = { message: string | null };

// XTC coordinates held in memory; the topology comes from `structureUrl` (or `model`) and must have a matching atom count.
type ViewerCoordinates = { data: Uint8Array; format: "xtc" };

type ViewerModel = { data: string | Uint8Array; format: "pdb" };

type StructureViewerProps = {
  // Empty or null leaves the viewer idle (plugin created, nothing loaded).
  structureUrl: string | null;
  // In-memory topology; wins over `structureUrl` when both are given.
  model?: ViewerModel;
  coordinates?: ViewerCoordinates;
  title: string;
  className?: string;
  height?: number;
  // "minimal": own reset/spin/screenshot/fullscreen buttons (sidebar). "full": the native Mol* viewport controls.
  variant?: "minimal" | "full";
  onStatus?: (status: ViewerStatus, info?: ViewerStatusInfo) => void;
  // Called when the user presses "Try again" on the error overlay, after the viewer restarted itself.
  onRetry?: () => void;
};

export type { StructureViewerProps, ViewerCoordinates, ViewerModel, ViewerStatus };
