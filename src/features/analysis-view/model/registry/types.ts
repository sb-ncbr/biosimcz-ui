import type { ComponentType, LazyExoticComponent } from "react";
import type { AnalysisBase, ParseResult } from "@/entities/analysis";

type PanelContext = { instanceId: string; analysisName: string; frameStepNs: number | null; atoms: number | null };
type PanelProps<T> = { data: T; context: PanelContext; config?: Readonly<Record<string, unknown>> };

type RendererEntry<T> = {
  bases: readonly AnalysisBase[];
  parse: (raw: unknown) => ParseResult<T>;
  Panel: LazyExoticComponent<ComponentType<PanelProps<T>>>;
  // Per-base settings for panels that share one payload shape.
  config?: Readonly<Record<string, unknown>>;
};

type ResolvedRenderer = { entry: RendererEntry<unknown>; base: AnalysisBase } | null;

export type { PanelContext, PanelProps, RendererEntry, ResolvedRenderer };
