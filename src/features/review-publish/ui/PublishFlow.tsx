"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { draftHref, type FieldRef } from "@/entities/deposition";
import { loginHref } from "@/entities/session";
import { useDraft } from "@/features/draft";
import { enableShowRequired } from "@/shared/lib/showRequired";
import { publishDraft } from "../actions";
import { requestReviewFocus } from "../model/focusRequest";
import type { PublishFailure, PublishOutcome } from "../model/types";
import { PublishDialog } from "./PublishDialog";

// Shape the shell's ActionBar needs; mirrors the widget's PublishModel without importing the widget layer.
type PublishModelLike = { state: "blocked" | "ready" | "publishing"; reason?: string; blockedHref?: string };

type PublishFlowValue = {
  // The enable-rule model, with "publishing" while the request runs.
  publish: PublishModelLike;
  // Ready Publish click: saves pending edits first, then opens the confirm dialog.
  requestPublish: () => void;
  // Blocked Publish click: switches on "show required" and asks Review to focus its box.
  onBlocked: () => void;
  // Rows from a failed server re-validation; replace the local list on Review until the draft changes.
  serverProblems: FieldRef[] | null;
};

const PublishFlowContext = createContext<PublishFlowValue | null>(null);

const usePublishFlow = (): PublishFlowValue => {
  const value = useContext(PublishFlowContext);
  if (!value) throw new Error("usePublishFlow must be used inside PublishFlowProvider");
  return value;
};

type Phase = "idle" | "confirming" | "publishing";

type PublishResult = { ok: true; value: PublishOutcome } | { ok: false; error: PublishFailure };

// 60 s without an answer is an unknown outcome, not a failure (missing-states 6.3).
const TIMEOUT_MS = 60_000;
const TIMED_OUT = Symbol("timed-out");

const withTimeout = async <T,>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

// Yield once so the state set by a just-finished flush is committed before it is read.
const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type ProviderProps = {
  // Enable rule result (completeness, uploads, connectivity), built by the shell.
  base: PublishModelLike;
  // Injected in tests; production calls the server action.
  publishAction?: (draftId: string) => Promise<PublishResult>;
  children: ReactNode;
};

// Owns the Publish flow (plan 4.7): confirm dialog, the server action and its failures, and the hand-over to the success
// page. Mounted inside DraftProvider by the wizard layout.
const PublishFlowProvider = ({ base, publishAction = publishDraft, children }: ProviderProps) => {
  const router = useRouter();
  const { draftId, draft, state, flush, reloadFromServer } = useDraft();
  const [phase, setPhase] = useState<Phase>("idle");
  const [problems, setProblems] = useState<{ draft: typeof draft; rows: FieldRef[] } | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const reviewHref = draftHref(draftId, "review");

  const fail = useCallback(
    (error: PublishFailure, retry: () => void) => {
      setPhase("idle");
      if (error.problems && error.problems.length > 0) {
        // The server found what the browser did not (stale tab): show the rows on Review.
        setProblems({ draft, rows: error.problems });
        enableShowRequired(draftId);
        requestReviewFocus();
        router.push(reviewHref);
        return;
      }
      if (error.kind === "auth") {
        toast.error("Your session expired", {
          description: "Sign in again. Your draft is saved.",
          action: { label: "Sign in", onClick: () => window.location.assign(loginHref(reviewHref, { expired: true })) },
        });
      } else if (error.kind === "conflict") {
        const gone = error.code === "not_editable";
        toast.error(gone ? "This deposition can no longer be edited" : "This draft changed somewhere else", {
          description: gone ? "It may already be published. Check My depositions." : "Load the newer version before publishing.",
          action: gone
            ? { label: "My depositions", onClick: () => router.push("/depositions") }
            : { label: "Load newer version", onClick: () => void reloadFromServer() },
        });
      } else if (error.kind === "timeout") {
        toast.error("No answer from the server", {
          description: "Check My depositions in a minute before trying again, so the deposition is not published twice.",
          action: { label: "Open My depositions", onClick: () => router.push("/depositions") },
          duration: Infinity,
        });
      } else if (error.kind === "validation") {
        toast.error("The server did not accept this deposition", {
          description: "Review the required fields and try again.",
          action: { label: "Open Review", onClick: () => router.push(reviewHref) },
        });
      } else {
        toast.error("Publishing failed", {
          description: "Nothing was published and your draft is saved. Try again, or contact the e-INFRA CZ helpdesk if it keeps failing.",
          action: { label: "Try again", onClick: retry },
          duration: Infinity,
        });
      }
    },
    [draft, draftId, reloadFromServer, reviewHref, router],
  );

  const submitRef = useRef<() => Promise<void>>(async () => {});
  const submit = useCallback(async () => {
    setPhase("publishing");
    setProblems(null);
    const retry = () => void submitRef.current();
    const result = await withTimeout(publishAction(draftId), TIMEOUT_MS);
    if (result === TIMED_OUT) return fail({ kind: "timeout", messageKey: "errors.timeout" }, retry);
    if (!result.ok) return fail(result.error, retry);
    // The dialog stays in "publishing" until the wizard unmounts, so the button cannot be pressed twice.
    router.replace(`/depositions/${encodeURIComponent(draftId)}/published`);
  }, [draftId, fail, publishAction, router]);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const requestPublish = useCallback(async () => {
    await flush();
    await nextTick();
    if (stateRef.current.unsaved) {
      toast.error("Your latest changes are not saved yet", { description: "Publish again in a moment." });
      return;
    }
    setPhase("confirming");
  }, [flush]);

  const onBlocked = useCallback(() => {
    enableShowRequired(draftId);
    requestReviewFocus();
  }, [draftId]);

  // Server rows describe the draft they were computed from; once it changes the local list is the truth again.
  const serverProblems = problems && problems.draft === draft ? problems.rows : null;

  const value = useMemo<PublishFlowValue>(
    () => ({
      publish: phase === "publishing" ? { state: "publishing" } : base,
      requestPublish: () => void requestPublish(),
      onBlocked,
      serverProblems,
    }),
    [base, onBlocked, phase, requestPublish, serverProblems],
  );

  return (
    <PublishFlowContext.Provider value={value}>
      {children}
      <PublishDialog
        open={phase !== "idle"}
        publishing={phase === "publishing"}
        onConfirm={() => void submit()}
        onCancel={() => setPhase("idle")}
      />
    </PublishFlowContext.Provider>
  );
};

export { PublishFlowProvider, usePublishFlow };
export type { PublishFlowValue, PublishModelLike, PublishResult };
