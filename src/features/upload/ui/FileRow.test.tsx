import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UploadItem } from "../model/uploadMachine";
import { FileRow } from "./FileRow";

const base: UploadItem = {
  id: "a",
  key: "conf.gro",
  name: "conf.gro",
  size: 5_033_165,
  lastModified: 1,
  status: "queued",
  loaded: 0,
  role: "structure_and_box",
};

const setup = (patch: Partial<UploadItem>) => {
  const handlers = { onRetry: vi.fn(), onRemove: vi.fn(), onResume: vi.fn() };
  render(
    <ul>
      <FileRow item={{ ...base, ...patch }} accept={[".top", ".gro", ".pdb"]} maxBytes={52_428_800} {...handlers} />
    </ul>,
  );
  return handlers;
};

describe("FileRow states", () => {
  it("queued: waiting copy and a labelled remove button", async () => {
    const handlers = setup({});
    expect(screen.getByText("Waiting to upload")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove conf.gro" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("a");
  });

  it("uploading: progress with a value text and remove to cancel", () => {
    setup({ status: "uploading", loaded: 3_250_586 });
    expect(screen.getByText("Uploading - 3.1 of 4.8 MB")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Uploading conf.gro" });
    expect(bar).toHaveAttribute("aria-valuetext", "3.1 of 4.8 MB");
    expect(screen.getByRole("button", { name: "Remove conf.gro" })).toBeInTheDocument();
  });

  it("committing and parsing: spinner, no remove", () => {
    setup({ status: "committing" });
    expect(screen.getByText("Finishing upload...")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "In progress" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("done: shows the role, and removes without confirmation when nothing was prefilled", async () => {
    const handlers = setup({ status: "done", loaded: base.size });
    expect(screen.getByText("Structure and box")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove conf.gro" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("a");
  });

  it("done with prefilled fields asks before removing", async () => {
    const user = userEvent.setup();
    const handlers = setup({ status: "done", parse: { status: "ok", fields: [{ path: "system.engine.name", value: "GROMACS" }] } });
    await user.click(screen.getByRole("button", { name: "Remove conf.gro" }));
    expect(handlers.onRemove).not.toHaveBeenCalled();
    expect(screen.getByText("Fields filled in from this file stay as they are. You can change them below.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove file" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("a");
  });

  it("done but unreadable: error text", () => {
    setup({ status: "done", parse: { status: "unreadable", fields: [] } });
    expect(screen.getByText("Could not be read")).toBeInTheDocument();
  });

  it("failed (network): Retry calls onRetry", async () => {
    const handlers = setup({ status: "failed", failReason: "network" });
    expect(screen.getByText("Upload failed. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(handlers.onRetry).toHaveBeenCalledWith("a");
  });

  it("failed (server rejected): no retry, only remove", () => {
    setup({ status: "failed", failReason: "rejected" });
    expect(screen.getByText(/did not accept this file/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove conf.gro" })).toBeInTheDocument();
  });

  it("interrupted: re-selecting a file calls onResume, a mismatch shows the different-file copy", async () => {
    const user = userEvent.setup();
    const handlers = setup({ status: "interrupted", failReason: "auth" });
    expect(screen.getByText("Upload interrupted. Select the file again to continue.")).toBeInTheDocument();
    const file = new File(["x"], "conf.gro");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(handlers.onResume).toHaveBeenCalledWith("a", file);
    expect(screen.getByRole("button", { name: "Select file" })).toBeInTheDocument();
  });

  it("interrupted with mismatch", () => {
    setup({ status: "interrupted", resumeMismatch: true });
    expect(screen.getByText("This is a different file. Select conf.gro (4.8 MB), or remove this row.")).toBeInTheDocument();
  });

  it("removing and remove_failed", async () => {
    const view = setup({ status: "removing" });
    expect(screen.getByText("Removing...")).toBeInTheDocument();
    expect(view.onRemove).not.toHaveBeenCalled();
  });

  it("remove_failed retries the removal", async () => {
    const handlers = setup({ status: "remove_failed", loaded: base.size });
    expect(screen.getByText("Could not remove the file. Try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("a");
  });

  it.each([
    ["too_large", { size: 2_254_857_830, name: "big.gro" }, "big.gro is 2.1 GB. The limit is 50 MB per file."],
    ["type", { name: "run.exe" }, ".exe files are not accepted here. Use .top, .gro or .pdb."],
    ["duplicate", { name: "conf.gro" }, "A file named conf.gro is already in this deposition."],
  ] as const)("rejected (%s)", (rejectReason, patch, text) => {
    setup({ status: "rejected", rejectReason, ...patch });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("paused: offline copy with remove still available", async () => {
    const handlers = setup({ status: "paused" });
    expect(screen.getByText("Paused - waiting for connection")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove conf.gro" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("a");
  });

  it("unreadable: offers Replace file and passes the chosen file", async () => {
    const onReplace = vi.fn();
    render(
      <ul>
        <FileRow
          item={{ ...base, name: "topol.top", key: "topol.top", status: "done", parse: { status: "unreadable", fields: [] } }}
          accept={[".top"]}
          maxBytes={100}
          onRetry={vi.fn()}
          onRemove={vi.fn()}
          onResume={vi.fn()}
          onReplace={onReplace}
        />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Replace topol.top" })).toBeInTheDocument();
    const file = new File(["x"], "topol.top");
    await userEvent.upload(screen.getByTestId("replace-input"), file);
    expect(onReplace).toHaveBeenCalledWith("a", file);
  });
});
