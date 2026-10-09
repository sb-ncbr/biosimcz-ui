"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { loginHref } from "@/entities/session";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui";
import { RETRYING_LIMIT } from "../model/saveState";
import { useDraft } from "./DraftProvider";

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

// Save problems that need the user (missing-states 2.2): restore prompt, save failed, offline, revision conflict and
// session expiry. Routine autosave stays silent; the sidebar shows the status.
const DraftStatusAlerts = () => {
  const { state, restore, restoreMirror, discardMirror, retryNow, reloadFromServer, keepMine } = useDraft();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  const resolve = async (action: () => Promise<boolean>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const saveFailed = state.status === "save-failed" && state.failures > RETRYING_LIMIT;

  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-3 empty:hidden">
      {restore ? (
        <Alert>
          <AlertTitle>Unsaved changes from your last visit</AlertTitle>
          <AlertDescription>
            <p>We found changes from {dateTime.format(restore.savedAt)} that were not saved to the server.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={restoreMirror}>
                Restore changes
              </Button>
              <Button size="sm" variant="ghost" onClick={discardMirror}>
                Discard
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {state.offline ? (
        <Alert variant="warning">
          <AlertTitle>You are offline</AlertTitle>
          <AlertDescription>
            You can keep working. Changes are kept on this device and saved when you reconnect. File uploads are paused.
          </AlertDescription>
        </Alert>
      ) : null}

      {saveFailed && !state.offline ? (
        <Alert variant="error" role="alert">
          <AlertTitle>Your latest changes are not saved yet</AlertTitle>
          <AlertDescription>
            <p>We keep them on this device and keep trying. If this continues, check your connection or contact the e-INFRA CZ helpdesk.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={retryNow}>
              Retry now
            </Button>
            {state.errorCode ? <p className="text-text-muted mt-2 text-xs">Details: {state.errorCode}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <AlertDialog open={state.status === "conflict"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This draft was changed elsewhere</AlertDialogTitle>
            <AlertDialogDescription>
              Someone, or you in another tab, saved a newer version. Load it to continue. Your changes from this tab stay on this device so you
              can re-enter them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => void resolve(keepMine)}>
              Keep my version
            </Button>
            <Button disabled={busy} autoFocus onClick={() => void resolve(reloadFromServer)}>
              Load newer version
            </Button>
          </AlertDialogFooter>
          <p className="text-text-muted text-xs">Keeping your version replaces the newer version on the server.</p>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={state.status === "session-expired"}>
        <DialogContent
          showCloseButton={false}
          role="alertdialog"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Your session has expired</DialogTitle>
            <DialogDescription>
              Your changes are kept on this device. Log in again to save them and continue where you left off.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild>
              <a href={loginHref(pathname, { expired: true })}>Log in again</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { DraftStatusAlerts };
