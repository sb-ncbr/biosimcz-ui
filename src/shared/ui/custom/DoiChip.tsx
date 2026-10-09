"use client";

import { Copy } from "lucide-react";
import { copyDoi } from "@/shared/lib/copyText";
import { Button } from "@e-infra/design-system";

// Sits above the card's whole-card link (z-10), so clicking it copies instead of navigating.
const DoiChip = ({ doi }: { doi: string }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    aria-label={`Copy DOI ${doi}`}
    onClick={() => void copyDoi(doi)}
    className="text-text-muted relative z-10 h-7 gap-1.5 px-2 text-xs font-normal max-md:min-h-11"
  >
    <Copy className="size-3.5" aria-hidden />
    {doi}
  </Button>
);

export { DoiChip };
