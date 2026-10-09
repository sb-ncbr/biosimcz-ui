"use client";

import "molstar/build/viewer/molstar.css";
import "./molstar-viewer.css";

import { Camera, Maximize2, Rotate3d, RotateCcw } from "lucide-react";
import { loadTrajectory } from "molstar/lib/extensions/plugin/loaders";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import type { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import { DefaultPluginUISpec, type PluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib";
import { Alert, AlertDescription, Button, Skeleton } from "@/shared/ui";
import type { StructureViewerProps, ViewerCoordinates, ViewerModel, ViewerStatus } from "./types";

const DEFAULT_HEIGHT = 420;
const FALLBACK_MESSAGE = "The 3D structure could not be loaded.";

const saveDataUri = (uri: string, filename: string): void => {
  const link = document.createElement("a");
  link.href = uri;
  link.download = filename;
  link.click();
};


const buildSpec = (variant: "minimal" | "full"): PluginUISpec => {
  const spec = DefaultPluginUISpec();
  if (variant === "minimal") {
    spec.layout = { initial: { isExpanded: false, showControls: false } };
    return spec;
  }
  spec.layout = { initial: { isExpanded: false, showControls: true, regionState: { bottom: "hidden", left: "collapsed", right: "hidden", top: "hidden" } } };
  spec.components = { ...spec.components, controls: { ...spec.components?.controls, top: "none", bottom: "none", left: "none" }, remoteState: "none" };
  spec.config = [
    [PluginConfig.Viewport.ShowControls, true],
    [PluginConfig.Viewport.ShowReset, true],
    [PluginConfig.Viewport.ShowExpand, true],
    [PluginConfig.Viewport.ShowToggleFullscreen, true],
    [PluginConfig.Viewport.ShowSelectionMode, true],
    [PluginConfig.Viewport.ShowSettings, true],
    [PluginConfig.Viewport.ShowAnimation, true],
    [PluginConfig.Viewport.ShowTrajectoryControls, true],
    [PluginConfig.Viewport.ShowScreenshotControls, true],
  ];
  return spec;
};

// Mol* data builders accept a plain ArrayBuffer-backed view only.
const asBytes = (data: Uint8Array): Uint8Array<ArrayBuffer> => (data.buffer instanceof ArrayBuffer ? (data as Uint8Array<ArrayBuffer>) : new Uint8Array(data));

type Source = { structureUrl: string | null; model: ViewerModel | undefined; coordinates: ViewerCoordinates | undefined };

// Replaces whatever the plugin holds; the plugin (and its WebGL context) stays alive across sources.
const loadSource = async (plugin: PluginUIContext, { structureUrl, model, coordinates }: Source): Promise<void> => {
  await plugin.clear();
  const modelData = model ? (typeof model.data === "string" ? model.data : asBytes(model.data)) : undefined;
  if (coordinates) {
    await loadTrajectory(plugin, {
      model:
        modelData !== undefined
          ? { kind: "model-data", data: modelData, format: "pdb" }
          : { kind: "model-url", url: structureUrl ?? "", format: "pdb", isBinary: false },
      coordinates: { kind: "coordinates-data", data: asBytes(coordinates.data), format: coordinates.format },
    });
    return;
  }
  const data =
    modelData !== undefined
      ? await plugin.builders.data.rawData({ data: modelData })
      : await plugin.builders.data.download({ url: structureUrl ?? "", isBinary: false }, { state: { isGhost: true } });
  const trajectory = await plugin.builders.structure.parseTrajectory(data, "pdb");
  await plugin.builders.structure.hierarchy.applyPreset(trajectory, "default");
};

const MolstarViewer = ({
  structureUrl,
  model,
  coordinates,
  title,
  className,
  height = DEFAULT_HEIGHT,
  variant = "minimal",
  onStatus,
  onRetry,
}: StructureViewerProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  // Loads run one after another on the same plugin so a fast prop change never interleaves two clear/load sequences.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const onStatusRef = useRef(onStatus);
  const [plugin, setPlugin] = useState<PluginUIContext | null>(null);
  const hasSource = Boolean(model) || Boolean(structureUrl);
  const [status, setStatus] = useState<ViewerStatus>(hasSource ? "loading" : "idle");
  const [spinning, setSpinning] = useState(false);
  // Bumping it re-runs the plugin effect: Retry rebuilds the plugin instead of patching a half-failed one.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  const report = useCallback((next: ViewerStatus, message: string | null = null) => {
    setStatus(next);
    onStatusRef.current?.(next, next === "error" ? { message } : undefined);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let created: PluginUIContext | null = null;
    // A fresh mount point per run: Mol* cannot createRoot() twice on one element (React dev runs effects twice).
    const target = document.createElement("div");
    target.style.cssText = "position:absolute;inset:0";
    host.appendChild(target);
    queueRef.current = Promise.resolve();

    createPluginUI({ target, render: renderReact18, spec: buildSpec(variant) })
      .then((instance) => {
        if (disposed) {
          instance.dispose();
          return;
        }
        created = instance;
        setPlugin(instance);
      })
      .catch(() => {
        if (!disposed) report("error", FALLBACK_MESSAGE);
      });

    return () => {
      disposed = true;
      created?.dispose();
      setPlugin(null);
      target.remove();
    };
  }, [variant, attempt, report]);

  useEffect(() => {
    if (!plugin) return;
    let cancelled = false;
    const source: Source = { structureUrl, model, coordinates };

    const run = async () => {
      if (cancelled) return;
      if (!model && !structureUrl) {
        await plugin.clear();
        if (!cancelled) report("idle");
        return;
      }
      report("loading");
      try {
        await loadSource(plugin, source);
        if (!cancelled) report("ready");
      } catch {
        if (!cancelled) report("error", FALLBACK_MESSAGE);
      }
    };
    queueRef.current = queueRef.current.then(run, run);

    return () => {
      cancelled = true;
    };
  }, [plugin, structureUrl, model, coordinates, report]);

  const retry = () => {
    setSpinning(false);
    setAttempt((value) => value + 1);
    report("loading");
    onRetry?.();
  };

  const reset = () => void plugin?.managers.camera.reset();

  const toggleSpin = () => {
    const canvas = plugin?.canvas3d;
    if (!canvas) return;
    const next = !spinning;
    canvas.setProps({ trackball: { animate: next ? { name: "spin", params: { speed: 1 } } : { name: "off", params: {} } } });
    setSpinning(next);
  };

  const fullscreen = () => {
    const box = boxRef.current;
    if (!box) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.requestFullscreen?.();
  };

  const screenshot = async () => {
    const helper = plugin?.helpers.viewportScreenshot;
    if (!helper) return;
    saveDataUri(await helper.getImageDataUri(), `${title.replace(/[^\w-]+/g, "_") || "structure"}.png`);
  };

  const notReady = status !== "ready";

  return (
    <div
      ref={boxRef}
      role="group"
      aria-label={`3D structure viewer: ${title}`}
      data-status={status}
      className={cn("mdr-molstar bg-surface border-border relative w-full overflow-hidden rounded-lg border", className)}
      style={{ height }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {variant === "minimal" ? (
        <div className="absolute top-2 right-2 z-20 flex gap-1">
          <Button type="button" size="icon" variant="outline" aria-label="Reset camera" disabled={notReady} onClick={reset}>
            <RotateCcw aria-hidden className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" aria-label="Spin" aria-pressed={spinning} disabled={notReady} onClick={toggleSpin}>
            <Rotate3d aria-hidden className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" aria-label="Download screenshot" disabled={notReady} onClick={() => void screenshot()}>
            <Camera aria-hidden className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" aria-label="Toggle fullscreen" onClick={fullscreen}>
            <Maximize2 aria-hidden className="size-4" />
          </Button>
        </div>
      ) : null}
      {status === "loading" ? <Skeleton role="status" aria-label="Loading 3D structure" className="absolute inset-0 z-10 rounded-none" /> : null}
      {status === "error" ? (
        <div className="bg-surface absolute inset-0 z-10 flex items-center justify-center p-4">
          <Alert variant="error" role="alert" className="max-w-sm">
            <AlertDescription className="flex flex-col items-start gap-3">
              {FALLBACK_MESSAGE}
              <Button type="button" size="sm" variant="outline" onClick={retry}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </div>
  );
};

export { MolstarViewer };
