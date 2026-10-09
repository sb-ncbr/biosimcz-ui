import type { ReactNode } from "react";
import type { DepositionDraft } from "@/entities/deposition";
import { createMemoryMirror, DraftProvider } from "@/features/draft";
import { SystemUploadsProvider } from "@/features/step-system";
import { UploadsRegistryProvider } from "@/features/upload";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PublishFlowProvider, type PublishModelLike, type PublishResult } from "./PublishFlow";

// Shared by the Review, publish flow and success tests: a real DraftProvider around the pieces under test.
const renderInWizard = (
  draft: DepositionDraft,
  ui: ReactNode,
  options: { base?: PublishModelLike; publishAction?: (draftId: string) => Promise<PublishResult> } = {},
) =>
  renderWithProviders(
    <DraftProvider
      userId="u1"
      mirror={createMemoryMirror()}
      initial={{
        id: "d1",
        status: "draft",
        revision: 1,
        createdAt: "2026-09-30T00:00:00Z",
        updatedAt: "2026-09-30T00:00:00Z",
        draft,
        files: [],
      }}
    >
      <UploadsRegistryProvider>
        <SystemUploadsProvider>
          <PublishFlowProvider base={options.base ?? { state: "ready" }} publishAction={options.publishAction}>
            {ui}
          </PublishFlowProvider>
        </SystemUploadsProvider>
      </UploadsRegistryProvider>
    </DraftProvider>,
  );

export { renderInWizard };
