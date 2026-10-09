"use client";

import { Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Study } from "@/entities/deposition";
import { NewDepositionButton } from "@/features/deposition-create";
import { Button, Card, CardContent, H1, Muted } from "@/shared/ui";
import { accessLabel, accessNote, licenseLabel } from "../model/format";

type PublishedViewProps = {
  study: Study;
  doi: string | null;
  // TODO(backend): record route (Q7, backend doc item 10). Until it exists there is no "View record" button.
  recordHref?: string;
};

const copy = async (doi: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(doi);
    toast.success("DOI copied");
  } catch {
    toast.error("Could not copy. Select the DOI and copy it manually.");
  }
};

// Success page after Publish (missing-states 6.5). No confetti; focus moves to the heading so screen readers start here.
const PublishedView = ({ study, doi, recordHref }: PublishedViewProps) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const title = study.title?.trim() || "Your deposition";
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col items-start gap-4 px-4 py-12">
      <div className="flex flex-col gap-1">
        <H1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
          Deposition published
        </H1>
        <Muted>{title} is now public.</Muted>
      </div>
      <Card className="w-full">
        <CardContent className="flex flex-col gap-3">
          {doi ? (
            <div className="flex items-center gap-2">
              <span className="text-text-muted w-16 text-xs">DOI</span>
              <code className="min-w-0 flex-1 truncate text-sm">{doi}</code>
              <Button type="button" variant="ghost" size="icon" aria-label="Copy DOI" onClick={() => void copy(doi)}>
                <Copy className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-text-muted w-16 text-xs">Access</span>
            <span>
              <span className="font-medium">{accessLabel(study) || "Not set"}</span>
              {accessNote(study) ? <span className="text-text-muted ml-2 text-xs">{accessNote(study)}</span> : null}
            </span>
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-text-muted w-16 text-xs">License</span>
            <span>{licenseLabel(study)}</span>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        {recordHref ? (
          <Button asChild>
            <Link href={recordHref}>View record</Link>
          </Button>
        ) : null}
        <Button asChild variant={recordHref ? "outline" : "default"}>
          <Link href="/depositions">Go to My depositions</Link>
        </Button>
        <NewDepositionButton variant="link" label="Start a new deposition" />
      </div>
    </div>
  );
};

export { PublishedView };
export type { PublishedViewProps };
