"use client";

import type { Run } from "@/entities/deposition";
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

type DeleteRunDialogProps = {
  run: Run | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (run: Run) => void;
};

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? "" : "s"}`;

// Destructive confirm (missing-states 5.3). Closed while `run` is null.
const DeleteRunDialog = ({ run, onOpenChange, onConfirm }: DeleteRunDialogProps) => (
  <AlertDialog open={run !== null} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete run {run?.name?.trim() || "Unnamed run"}?</AlertDialogTitle>
        <AlertDialogDescription>
          {run && run.fileKeys.length > 0
            ? `Its settings and ${plural(run.fileKeys.length, "uploaded file")} are deleted. This cannot be undone.`
            : "Its settings are deleted. This cannot be undone."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className={buttonVariants({ variant: "error" })}
          onClick={() => {
            if (run) onConfirm(run);
          }}
        >
          Delete run
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export { DeleteRunDialog };
