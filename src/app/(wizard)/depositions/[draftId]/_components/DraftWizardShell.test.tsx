import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft, type DepositionDraft } from "@/entities/deposition";
import { createMemoryMirror, DraftProvider } from "@/features/draft";
import { SystemUploadsProvider } from "@/features/step-system";
import { UploadsRegistryProvider } from "@/features/upload";
import { completeDraft } from "@/test/depositionFixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DraftWizardShell } from "./DraftWizardShell";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const publishDraft = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => "/depositions/d1/study",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/features/review-publish/actions", () => ({ publishDraft }));

const renderShell = (draft: DepositionDraft, children: ReactNode = <h1>Page</h1>) =>
  renderWithProviders(
    <DraftProvider
      userId="u1"
      mirror={createMemoryMirror()}
      initial={{ id: "d1", status: "draft", revision: 1, createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z", draft, files: [] }}
    >
      <UploadsRegistryProvider>
        <SystemUploadsProvider>
          <DraftWizardShell appBar={null}>{children}</DraftWizardShell>
        </SystemUploadsProvider>
      </UploadsRegistryProvider>
    </DraftProvider>,
  );

const publishButton = () => screen.getByRole("button", { name: /^Publish/ });

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
  toast.error.mockClear();
  publishDraft.mockReset();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ revision: 2, updatedAt: "2026-09-30T00:01:00Z" }), { status: 200 })));
});

describe("Publish enable rule in the wizard shell", () => {
  it("is blocked with the reason while required fields are left, and a click goes to Review", async () => {
    renderShell(emptyDraft());
    expect(publishButton()).toHaveAttribute("aria-disabled", "true");
    expect(publishButton()).toHaveAccessibleDescription("Fill in 14 required fields to publish");
    await userEvent.click(publishButton());
    expect(nav.push).toHaveBeenCalledWith("/depositions/d1/review");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    // "Go to field" mode is on, so the steps show their missing messages.
    expect(window.sessionStorage.getItem("mdrepo:show-required:d1")).toBe("1");
  });

  it("names format errors", () => {
    const draft = completeDraft();
    draft.study.doi = "10.12";
    renderShell(draft);
    expect(publishButton()).toHaveAccessibleDescription("Fix 1 field to publish");
  });

  it("is enabled for a complete draft and opens the confirm dialog", async () => {
    renderShell(completeDraft());
    expect(publishButton()).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(publishButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Publish this deposition?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("confirming publishes that draft and opens the success page", async () => {
    publishDraft.mockResolvedValue({ ok: true, value: { status: "published", doi: null, recordUrl: null } });
    renderShell(completeDraft());
    await userEvent.click(publishButton());
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/depositions/d1/published"));
    expect(publishDraft).toHaveBeenCalledWith("d1");
  });

  it("the sidebar Add run menu adds a run and opens its editor", async () => {
    renderShell(completeDraft());
    const sidebar = within(screen.getByRole("complementary", { name: "Deposition sidebar" }));
    await userEvent.click(sidebar.getByRole("button", { name: "Add run" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Energy minimization/ }));
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push.mock.calls[0]?.[0]).toMatch(/^\/depositions\/d1\/experiments\/run-/);
    // The new run shows up in the sidebar list at once.
    expect(sidebar.getByRole("link", { name: /Energy minimization/ })).toBeInTheDocument();
  });
});
