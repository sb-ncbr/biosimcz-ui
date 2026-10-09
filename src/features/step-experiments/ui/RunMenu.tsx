"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { draftHref, type Run } from "@/entities/deposition";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui";

type RunMenuProps = {
  draftId: string;
  run: Run;
  name: string;
  isFirst: boolean;
  isLast: boolean;
  onDuplicate: (runId: string) => void;
  onMove: (runId: string, delta: -1 | 1) => void;
  onDelete: (run: Run) => void;
};

// The "more" menu of a runs table row (missing-states 5.3). Move up and down are the keyboard way to reorder.
const RunMenu = ({ draftId, run, name, isFirst, isLast, onDuplicate, onMove, onDelete }: RunMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${name}`} className="max-md:size-11">
        <MoreHorizontal aria-hidden />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem asChild>
        <Link href={draftHref(draftId, "experiments", run.id)}>Edit</Link>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onDuplicate(run.id)}>Duplicate</DropdownMenuItem>
      <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(run.id, -1)}>
        Move up
      </DropdownMenuItem>
      <DropdownMenuItem disabled={isLast} onSelect={() => onMove(run.id, 1)}>
        Move down
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="error" onSelect={() => onDelete(run)}>
        Delete run
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export { RunMenu };
export type { RunMenuProps };
