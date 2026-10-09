import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { TrajectoryForm, type TrajectoryFormProps } from "./TrajectoryForm";

const setup = (props: Partial<TrajectoryFormProps> = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <TrajectoryForm
      initialValues={{ frames: "", selection: "" }}
      atoms={100}
      totalFrames={1000}
      busy={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSubmit, onCancel, user: userEvent.setup() };
};

describe("TrajectoryForm", () => {
  it("shows the 1-based placeholder and submits with Enter", async () => {
    const { onSubmit, user } = setup();
    const frames = screen.getByLabelText("Frame window");
    expect(frames).toHaveAttribute("placeholder", "1:1000:10");
    await user.type(frames, "1:50:5{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({ frames: "1:50:5", selection: "" });
  });

  it("shows an inline 1-based error and does not submit", async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText("Frame window"), "0:3:1{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Frames are numbered from 1");
    expect(screen.getByLabelText("Frame window")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears the inline error when the field is edited", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Frame window"), "0:3:1{Enter}");
    await user.type(screen.getByLabelText("Frame window"), "0");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks for confirmation above the size threshold", async () => {
    const { onSubmit, user } = setup({ atoms: 20_000, totalFrames: 25_000 });
    await user.click(screen.getByRole("button", { name: "Load trajectory" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Large download");
    await user.click(screen.getByRole("button", { name: "Download anyway" }));
    expect(onSubmit).toHaveBeenCalledWith({ frames: "", selection: "" });
  });

  it("keeps the request unsent when the warning is declined", async () => {
    const { onSubmit, user } = setup({ atoms: 20_000, totalFrames: 25_000 });
    await user.click(screen.getByRole("button", { name: "Load trajectory" }));
    await user.click(await screen.findByRole("button", { name: "Change the request" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not warn for a small window", async () => {
    const { onSubmit, user } = setup({ atoms: 20_000, totalFrames: 25_000 });
    await user.type(screen.getByLabelText("Frame window"), "1:10{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({ frames: "1:10", selection: "" });
  });

  it("shows Cancel instead of Load while busy and calls onCancel", async () => {
    const { onCancel, user } = setup({ busy: true });
    expect(screen.queryByRole("button", { name: "Load trajectory" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows a server-rejected field message until the field is edited", async () => {
    const { user } = setup({ serverFieldErrors: { frames: "Server says no." } });
    expect(screen.getByRole("alert")).toHaveTextContent("Server says no.");
    await user.type(screen.getByLabelText("Frame window"), "1");
    expect(screen.queryByText("Server says no.")).toBeNull();
  });
});
