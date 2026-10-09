"use client";

import { Loader2 } from "lucide-react";
import { useDraft } from "@/features/draft";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Icon,
} from "@/shared/ui";
import { accessSentence, licenseLabel } from "../model/format";
import { useCommunity } from "../model/useCommunity";

type PublishDialogProps = {
  open: boolean;
  publishing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Publish is irreversible, so it is an AlertDialog with initial focus on Cancel (missing-states 6.2). While the request
// runs it cannot be dismissed and Cancel is hidden (6.3).
const PublishDialog = ({ open, publishing, onConfirm, onCancel }: PublishDialogProps) => {
  const { draft } = useDraft();
  const { study } = draft;
  const community = useCommunity(study.communityId);
  const title = study.title?.trim() || "This deposition";
  const where = community ? `the ${community.name} community` : "the chosen community";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !publishing) onCancel();
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (publishing) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Publish this deposition?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>
                {title} will be public in {where} under {licenseLabel(study)}.
              </p>
              <p>{accessSentence(study)}</p>
              <p>After publishing you cannot delete it or change its files.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {publishing ? null : <AlertDialogCancel>Cancel</AlertDialogCancel>}
          {/* A plain Button, not AlertDialogAction: the dialog must stay open until the server answered. */}
          <Button type="button" onClick={publishing ? undefined : onConfirm} aria-disabled={publishing}>
            {publishing ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : null}
            {publishing ? "Publishing..." : "Publish"}
            {publishing ? null : <Icon name="send-15" className="size-[15px]" />}
          </Button>
        </AlertDialogFooter>
        <span role="status" className="sr-only">
          {publishing ? "Publishing" : ""}
        </span>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export { PublishDialog };
export type { PublishDialogProps };
