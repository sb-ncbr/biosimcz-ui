import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryMirror, DraftProvider } from "@/features/draft";
import { UploadsRegistryProvider, useDraftUploads, type UploadTransport } from "@/features/upload";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RunEditor } from "./RunEditor";
import { RunUploadsProvider } from "./RunUploadsProvider";
import { draftWith } from "./testUtils";

vi.mock("next/navigation", () => ({ usePathname: () => "/depositions/d1/experiments/r1", useRouter: () => ({ push: vi.fn() }) }));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ revision: 2, updatedAt: "2026-09-30T00:01:00Z" }), { status: 200 })));
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const Probe = () => <output data-testid="in-flight">{String(useDraftUploads().hasActive)}</output>;

const tree = (transport: UploadTransport, step: ReactNode) => (
  <DraftProvider
      userId="u1"
    mirror={createMemoryMirror()}
    initial={{ id: "d1", status: "draft", revision: 1, createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z", draft: draftWith({ name: "Run" }), files: [] }}
  >
    <UploadsRegistryProvider>
      <RunUploadsProvider options={{ transport }}>
        {step}
        <Probe />
      </RunUploadsProvider>
    </UploadsRegistryProvider>
  </DraftProvider>
);

describe("RunUploadsProvider", () => {
  it("counts a run upload as in flight, warns on unload and keeps uploading after the run screen unmounts", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    let aborted = false;
    const transport: UploadTransport = {
      init: () => Promise.resolve(),
      putContent: (_d, _k, _f, { signal, onProgress }) =>
        new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
          });
          release = () => {
            onProgress(1);
            resolve();
          };
        }),
      commit: () => Promise.resolve(),
      parse: () => Promise.resolve({ status: "unsupported", fields: [] }),
      remove: () => Promise.resolve(),
    };
    const { rerender } = renderWithProviders(tree(transport, <RunEditor runId="r1" />));
    await user.upload(await screen.findByTestId("dropzone-input"), [new File(["x"], "run.tpr")]);
    await waitFor(() => expect(screen.getByTestId("in-flight")).toHaveTextContent("true"));

    rerender(tree(transport, <p>Other step</p>));
    expect(screen.getByTestId("in-flight")).toHaveTextContent("true");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(aborted).toBe(false);

    await act(async () => release?.());
    await waitFor(() => expect(screen.getByTestId("in-flight")).toHaveTextContent("false"));
  });
});
