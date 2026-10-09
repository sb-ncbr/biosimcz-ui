import { act, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { emptyDraft } from "@/entities/deposition";
import { createMemoryMirror } from "../model/mirror";
import { DraftProvider, useDraft } from "./DraftProvider";

vi.mock("next/navigation", () => ({ usePathname: () => "/depositions/d1/study" }));

const Label = () => {
  const { save } = useDraft();
  return <output data-testid="save">{save.kind === "saved" ? save.label : save.kind}</output>;
};

const tree = () => (
  <DraftProvider
      userId="u1"
    mirror={createMemoryMirror()}
    initial={{ id: "d1", status: "draft", revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), draft: emptyDraft(), files: [] }}
  >
    <Label />
  </DraftProvider>
);

describe("DraftProvider save label", () => {
  it("renders a stable label on the server and hydrates without a mismatch, then shows relative time", async () => {
    const html = renderToString(tree());
    expect(html).toContain(">Saved<");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, tree(), { onRecoverableError });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("save").textContent).toBe("Saved just now"));
  });
});
