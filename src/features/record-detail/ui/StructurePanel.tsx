"use client";

import { Box } from "lucide-react";
import { useState } from "react";
import { RecordThumbnail } from "@/entities/record";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { StructureViewer, structureUrlFor } from "@/shared/viewers/molstar";

// Matches the poster: h-80 on phones, h-[28rem] from md.
const MOBILE_HEIGHT = 320;
const DESKTOP_HEIGHT = 448;

type StructurePanelProps = { recordId: string; title: string; className?: string };

// The thumbnail is the poster; Mol* (a large chunk plus WebGL) loads only when asked. On phones this also keeps a canvas
// that captures touch gestures from trapping the page scroll.
const StructurePanel = ({ recordId, title, className }: StructurePanelProps) => {
  // null = poster; a number = the viewer height chosen at activation (Mol* takes a fixed pixel height).
  const [height, setHeight] = useState<number | null>(null);

  if (height !== null) {
    return <StructureViewer structureUrl={structureUrlFor(recordId)} title={title} height={height} className={className} />;
  }

  return (
    <div className={cn("bg-base-50 relative flex h-80 items-center justify-center md:h-[28rem]", className)}>
      <RecordThumbnail accession={recordId} title={title} className="size-full rounded-none border-0 bg-transparent md:size-full" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setHeight(window.matchMedia?.("(min-width: 768px)").matches ? DESKTOP_HEIGHT : MOBILE_HEIGHT)} className="gap-1.5 shadow-sm max-md:min-h-11">
          <Box className="size-4" aria-hidden />
          View 3D structure
        </Button>
      </div>
    </div>
  );
};

export { StructurePanel };
