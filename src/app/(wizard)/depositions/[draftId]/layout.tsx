import type { ReactNode } from "react";
import { draftHref, isDraftId } from "@/entities/deposition";
import { DraftProvider } from "@/features/draft";
import { loadDraft } from "@/features/draft/server";
import { RunUploadsProvider } from "@/features/step-experiments";
import { SystemUploadsProvider } from "@/features/step-system";
import { UploadsRegistryProvider } from "@/features/upload";
import { requireSessionOrRedirect } from "@/server/session";
import { AppBar } from "@/widgets/app-bar";
import { notFound } from "next/navigation";
import { DraftWizardShell } from "./_components/DraftWizardShell";

type LayoutProps = { children: ReactNode; params: Promise<{ draftId: string }> };

// Auth is enforced here as well as in proxy.ts. The id is validated before it reaches an href, the `next` parameter or a
// backend call; loadDraft repeats the check for pages that call it on their own.
const DraftLayout = async ({ children, params }: LayoutProps) => {
  const { draftId } = await params;
  if (!isDraftId(draftId)) notFound();
  const session = await requireSessionOrRedirect(draftHref(draftId));
  const snapshot = await loadDraft(draftId);
  return (
    <DraftProvider initial={snapshot} userId={session.user.id}>
      {/* Uploads live at the layout level so they keep running across steps. */}
      <UploadsRegistryProvider>
        <SystemUploadsProvider>
          <RunUploadsProvider>
            <DraftWizardShell appBar={<AppBar user={session.user} />}>{children}</DraftWizardShell>
          </RunUploadsProvider>
        </SystemUploadsProvider>
      </UploadsRegistryProvider>
    </DraftProvider>
  );
};

export default DraftLayout;
