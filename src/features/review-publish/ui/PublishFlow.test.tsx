import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeDraft } from "@/test/depositionFixtures";
import { usePublishFlow, type PublishResult } from "./PublishFlow";
import { renderInWizard } from "./testUtils";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/depositions/d1/review",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));
vi.mock("sonner", () => ({ toast }));
// The provider imports the real server action for its default; tests always pass their own.
vi.mock("../actions", () => ({ publishDraft: vi.fn() }));

const Harness = () => {
  const { publish, requestPublish } = usePublishFlow();
  return (
    <button type="button" aria-disabled={publish.state !== "ready"} onClick={requestPublish}>
      {publish.state === "publishing" ? "Publishing..." : "Publish"}
    </button>
  );
};

const okResult: PublishResult = { ok: true, value: { status: "published", doi: "10.1234/mdrepo.d1", recordUrl: null } };

const draftWithCommunity = () => {
  const draft = completeDraft();
  draft.study.access = "embargoed";
  draft.study.embargo = { until: "2031-03-01" };
  return draft;
};

beforeEach(() => {
  nav.push.mockClear();
  nav.replace.mockClear();
  toast.error.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ revision: 2, updatedAt: "2026-09-30T00:01:00Z" }), { status: 200 })));
});

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Publish" }));
  return screen.findByRole("alertdialog", { name: "Publish this deposition?" });
};

describe("Publish confirm dialog", () => {
  it("states title, license, access and irreversibility, with initial focus on Cancel", async () => {
    renderInWizard(draftWithCommunity(), <Harness />, { publishAction: vi.fn() });
    const dialog = await open();
    expect(within(dialog).getByText(/Lysozyme in water will be public in .* under CC BY 4.0\./)).toBeInTheDocument();
    expect(within(dialog).getByText("Anyone can see the description. Files open on 1 Mar 2031.")).toBeInTheDocument();
    expect(within(dialog).getByText("After publishing you cannot delete it or change its files.")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("closes on Cancel without calling the server", async () => {
    const publishAction = vi.fn();
    renderInWizard(completeDraft(), <Harness />, { publishAction });
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(publishAction).not.toHaveBeenCalled();
  });

});

describe("Publish success", () => {
  it("shows a busy state, keeps the dialog open, and moves on to the success page", async () => {
    let finish: (value: PublishResult) => void = () => {};
    const publishAction = vi.fn(() => new Promise<PublishResult>((resolve) => (finish = resolve)));
    renderInWizard(completeDraft(), <Harness />, { publishAction });
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));

    expect(publishAction).toHaveBeenCalledWith("d1");
    expect(await within(dialog).findByRole("button", { name: "Publishing..." })).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();

    await act(async () => finish(okResult));
    expect(nav.replace).toHaveBeenCalledWith("/depositions/d1/published");
  });

  it("ignores a second press while publishing", async () => {
    const publishAction = vi.fn(() => new Promise<PublishResult>(() => {}));
    renderInWizard(completeDraft(), <Harness />, { publishAction });
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publishing..." }));
    expect(publishAction).toHaveBeenCalledOnce();
  });
});

describe("Publish failure", () => {
  it("toasts a network failure with Try again, which publishes again", async () => {
    const publishAction = vi
      .fn<(draftId: string) => Promise<PublishResult>>()
      .mockResolvedValueOnce({ ok: false, error: { kind: "network", messageKey: "errors.network" } })
      .mockResolvedValueOnce(okResult);
    renderInWizard(completeDraft(), <Harness />, { publishAction });
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    const [title, options] = toast.error.mock.calls[0] as [string, { description: string; action: { label: string; onClick: () => void } }];
    expect(title).toBe("Publishing failed");
    expect(options.description).toContain("Nothing was published and your draft is saved");
    expect(options.action.label).toBe("Try again");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();

    await act(async () => options.action.onClick());
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/depositions/d1/published"));
    expect(publishAction).toHaveBeenCalledTimes(2);
  });

  it("sends a failed server re-validation to Review with its rows", async () => {
    const publishAction = vi.fn(async (): Promise<PublishResult> => ({
      ok: false,
      error: {
        kind: "validation",
        messageKey: "errors.validation",
        problems: [
          { stepId: "study", sectionId: "basics", path: "title", label: "Title", location: "Study details - Basics", anchor: "field-basics-title", kind: "missing" },
        ],
      },
    }));
    renderInWizard(completeDraft(), <Harness />, { publishAction });
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/depositions/d1/review"));
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("mdrepo:show-required:d1")).toBe("1");
  });

  it("explains an unknown outcome and points to My depositions", async () => {
    const publishAction = vi.fn(async (): Promise<PublishResult> => ({ ok: false, error: { kind: "timeout", messageKey: "errors.timeout" } }));
    renderInWizard(completeDraft(), <Harness />, { publishAction });
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    const [title, options] = toast.error.mock.calls[0] as [string, { description: string; action: { label: string; onClick: () => void } }];
    expect(title).toBe("No answer from the server");
    expect(options.description).toContain("not published twice");
    options.action.onClick();
    expect(nav.push).toHaveBeenCalledWith("/depositions");
  });

  it("offers a way back in when the session expired", async () => {
    const publishAction = vi.fn(async (): Promise<PublishResult> => ({ ok: false, error: { kind: "auth", status: 401, messageKey: "errors.auth" } }));
    renderInWizard(completeDraft(), <Harness />, { publishAction });
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(toast.error.mock.calls[0]?.[0]).toBe("Your session expired");
  });
});
