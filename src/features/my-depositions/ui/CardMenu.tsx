"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { draftHref, type DepositionListItem } from "@/entities/deposition";
import { recordHref } from "@/entities/record";
import { copyDoi } from "@/shared/lib/copyText";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui";
import { DeleteDraftDialog } from "./DeleteDraftDialog";

// The "more" menu (missing-states 4.5): drafts get Continue editing and Delete draft, published ones View record and Copy DOI.
const CardMenu = ({ item, name }: { item: DepositionListItem; name: string }) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { doi } = item;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${name}`} className="relative z-10 max-md:size-11">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.kind === "draft" ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={draftHref(item.id)}>Continue editing</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="error" onSelect={() => setConfirmingDelete(true)}>
                Delete draft
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <Link href={recordHref(item.id)}>View record</Link>
              </DropdownMenuItem>
              {doi ? <DropdownMenuItem onSelect={() => void copyDoi(doi)}>Copy DOI</DropdownMenuItem> : null}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {item.kind === "draft" ? (
        <DeleteDraftDialog open={confirmingDelete} onOpenChange={setConfirmingDelete} draftId={item.id} title={item.title} />
      ) : null}
    </>
  );
};

export { CardMenu };
