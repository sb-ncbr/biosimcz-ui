"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Alert, AlertDescription, Button, Skeleton } from "@/shared/ui";
import type { StructureViewerProps } from "./types";

const DEFAULT_HEIGHT = 420;

// Mol* is heavy and touches WebGL and workers, so it never renders on the server and ships as its own chunk.
const LazyViewer = dynamic(() => import("./MolstarViewer").then((module) => module.MolstarViewer), {
  ssr: false,
  loading: () => <Skeleton role="status" aria-label="Loading 3D viewer" className="h-full w-full rounded-lg" />,
});

type BoundaryProps = { children: ReactNode; onRetry: () => void; className: string | undefined; height: number };

// Catches a failed chunk load or a crash inside Mol* so the rest of the page keeps working.
class ViewerBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        className={cn("border-border flex w-full items-center justify-center rounded-lg border p-4", this.props.className)}
        style={{ height: this.props.height }}
      >
        <Alert variant="error" role="alert" className="max-w-sm">
          <AlertDescription className="flex flex-col items-start gap-3">
            The 3D viewer failed to load.
            <Button type="button" size="sm" variant="outline" onClick={this.props.onRetry}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}

const StructureViewer = (props: StructureViewerProps) => {
  const [generation, setGeneration] = useState(0);
  const height = props.height ?? DEFAULT_HEIGHT;
  return (
    <ViewerBoundary key={generation} className={props.className} height={height} onRetry={() => setGeneration((value) => value + 1)}>
      <div className="w-full" style={{ height }}>
        <LazyViewer {...props} height={height} />
      </div>
    </ViewerBoundary>
  );
};

export { StructureViewer };
