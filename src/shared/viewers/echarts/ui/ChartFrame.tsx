"use client";

import { Download, RotateCcw } from "lucide-react";
import { safeFilename, saveBlob, saveDataUrl } from "@/shared/lib";
import { Badge, Button } from "@/shared/ui";
import type { ChartFrameProps } from "../types";
import { ChartEmpty } from "./ChartEmpty";

// Bordered section shared by every analysis chart: the summary line is the text alternative, CSV and PNG are the exports.
function ChartFrame({ title, description, summary, filename, height, chart, csv, empty, badge, actions, children }: ChartFrameProps) {
  const base = safeFilename(filename);
  const disabled = Boolean(empty);

  return (
    <section aria-label={title} className="border-border flex flex-col rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-text text-sm font-medium">{title}</h3>
          {description ? <p className="text-text-muted text-xs">{description}</p> : null}
        </div>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actions}
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => chart.current?.resetZoom()}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset zoom
        </Button>
        {csv ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => saveBlob(new Blob([csv()], { type: "text/csv;charset=utf-8" }), `${base}.csv`)}
          >
            <Download className="size-3.5" aria-hidden="true" />
            CSV
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const url = chart.current?.toPng();
            if (url) saveDataUrl(url, `${base}.png`);
          }}
        >
          <Download className="size-3.5" aria-hidden="true" />
          PNG
        </Button>
      </div>
      <p className="text-text-muted mt-2 text-xs">{summary}</p>
      <div className="mt-4">{empty ? <ChartEmpty reason={empty.reason} height={height} /> : children}</div>
    </section>
  );
}

export { ChartFrame };
