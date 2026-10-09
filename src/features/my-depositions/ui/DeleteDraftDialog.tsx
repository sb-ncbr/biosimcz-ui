"use client";

import { useTransition, type MouseEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  buttonVariants,
} from "@/shared/ui";
import { deleteDraft } from "../actions";

type DeleteDraftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  // Title shown in the sentence; empty drafts use the fallback name.
  title: string | null;
};

// Destructive confirm (missing-states 4.5). Stays open and shows "Deleting..." until the server answers.
const DeleteDraftDialog = ({ open, onOpenChange, draftId, title }: DeleteDraftDialogProps) => {
  const [pending, startTransition] = useTransition();

  const confirm = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await deleteDraft(draftId);
      if (result.ok) {
        toast.success("Draft deleted");
        onOpenChange(false);
      } else {
        toast.error("Could not delete the draft. Try again.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="font-semibold">{title ?? "Unnamed deposition"}</strong> and its uploaded files are deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "error" })} onClick={confirm} aria-disabled={pending} disabled={pending}>
            {pending ? "Deleting..." : "Delete draft"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export { DeleteDraftDialog };
