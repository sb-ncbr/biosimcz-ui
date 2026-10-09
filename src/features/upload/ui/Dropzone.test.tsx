import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dropzone } from "./Dropzone";

const accept = [".top", ".itp", ".gro"];
const setup = (onFiles = vi.fn(), disabled = false) => {
  render(<Dropzone accept={accept} maxBytes={52_428_800} onFiles={onFiles} disabled={disabled} />);
  return onFiles;
};

describe("Dropzone", () => {
  it("shows the accepted types and the size limit", () => {
    setup();
    expect(screen.getByRole("button", { name: "Select files" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((el) => el.textContent)).toEqual(accept);
    expect(screen.getByText("Max file size: 50 MB")).toBeInTheDocument();
  });

  it("passes files chosen through the picker and resets the input", async () => {
    const user = userEvent.setup();
    const onFiles = setup();
    const file = new File(["x"], "topol.top");
    await user.upload(screen.getByTestId("dropzone-input"), file);
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect((screen.getByTestId("dropzone-input") as HTMLInputElement).value).toBe("");
  });

  it("opens the picker from the keyboard-reachable Select files button", async () => {
    const user = userEvent.setup();
    setup();
    const click = vi.spyOn(screen.getByTestId("dropzone-input"), "click");
    await user.tab();
    expect(screen.getByRole("button", { name: "Select files" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("accepts dropped files and shows the drag-over text while dragging", () => {
    const onFiles = setup();
    const zone = screen.getByText("Max file size: 50 MB").parentElement as HTMLElement;
    const file = new File(["x"], "conf.gro");
    fireEvent.dragEnter(zone, { dataTransfer: { files: [file] } });
    expect(screen.getByText("Drop files to upload")).toBeInTheDocument();
    expect(zone).toHaveAttribute("data-dragging", "true");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(screen.queryByText("Drop files to upload")).not.toBeInTheDocument();
  });

  it("ignores drops and disables the button when disabled", () => {
    const onFiles = setup(vi.fn(), true);
    const zone = screen.getByText("Max file size: 50 MB").parentElement as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["x"], "conf.gro")] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Select files" })).toBeDisabled();
  });
});
