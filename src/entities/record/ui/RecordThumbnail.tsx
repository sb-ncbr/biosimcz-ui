"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib";
import { recordThumbnailUrl } from "../lib/href";

type Props = { accession: string; title: string | null; className?: string };

// Structure preview from our own BFF route. The box has a fixed size, so a missing or broken image only swaps the content
// for a quiet icon (no layout shift). The image may fail before hydration, hence the complete check on mount.
const RecordThumbnail = ({ accession, title, className }: Props) => {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <div
      className={cn(
        "bg-base-100 border-border flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border md:size-[120px]",
        className,
      )}
      data-testid="record-thumbnail"
    >
      {failed ? (
        <ImageOff aria-hidden className="text-text-muted size-5" data-testid="record-thumbnail-fallback" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- served by our BFF; next/image would need the remote host allowlisted
        <img
          ref={image}
          src={recordThumbnailUrl(accession)}
          alt={`Structure preview of ${title ?? accession}`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

export { RecordThumbnail };
