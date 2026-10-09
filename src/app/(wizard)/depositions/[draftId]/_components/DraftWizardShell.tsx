"use client";

import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { DraftStatusAlerts, useDraft } from "@/features/draft";
import { PublishFlowProvider, usePublishFlow } from "@/features/review-publish";
import { useRunActions } from "@/features/step-experiments";
import { useDraftUploads } from "@/features/upload";
import { WizardShell, type WizardNavModel } from "@/widgets/wizard-shell";
import { buildPublishModel, buildWizardNav } from "../_lib/nav";

type ShellProps = { nav: WizardNavModel; appBar: ReactNode; offline: boolean; children: ReactNode };

// Inside the publish provider: turns flow state into the shell's props.
const ShellWithPublish = ({ nav, appBar, offline, children }: ShellProps) => {
  const { publish, requestPublish, onBlocked } = usePublishFlow();
  const { addRun } = useRunActions();
  return (
    <WizardShell
      nav={nav}
      publish={publish}
      appBar={appBar}
      onPublish={requestPublish}
      onBlockedPublish={() => {
        if (offline) toast.error("You are offline. Publish when you are back online.");
        else onBlocked();
      }}
      onAddRun={addRun}
    >
      <DraftStatusAlerts />
      {children}
    </WizardShell>
  );
};

type DraftWizardShellProps = {
  // Server-rendered site app bar; passed through so the shell stays a client island only where it has to be.
  appBar: ReactNode;
  children: ReactNode;
};

// Feeds the shell from the live draft: counts, run list, title and save status all follow edits.
const DraftWizardShell = ({ appBar, children }: DraftWizardShellProps) => {
  const { draftId, draft, completeness, save } = useDraft();
  const nav = useMemo(() => buildWizardNav({ draftId, draft, completeness, save }), [draftId, draft, completeness, save]);
  const { hasActive, failed } = useDraftUploads();
  const base = useMemo(
    () => buildPublishModel({ draftId, completeness, save, uploadsInFlight: hasActive, uploadsFailed: failed }),
    [draftId, completeness, save, hasActive, failed],
  );
  return (
    <PublishFlowProvider base={base}>
      <ShellWithPublish nav={nav} appBar={appBar} offline={save.kind === "offline"}>
        {children}
      </ShellWithPublish>
    </PublishFlowProvider>
  );
};

export { DraftWizardShell };
