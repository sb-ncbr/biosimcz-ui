"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { analysisDataQuery, type ParseResult } from "@/entities/analysis";
import type { RendererEntry } from "./registry";

// Parsing sits in `select`, so it runs once per payload and not on every render.
const useAnalysis = (instanceId: string, analysisName: string, entry: RendererEntry<unknown> | null) => {
  const select = useCallback(
    (raw: unknown): ParseResult<unknown> => (entry ? entry.parse(raw) : { ok: false, issue: { path: "", message: "No renderer" } }),
    [entry],
  );
  return useQuery({ ...analysisDataQuery(instanceId, analysisName), enabled: entry !== null, select });
};

export { useAnalysis };
