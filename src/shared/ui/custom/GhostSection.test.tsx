import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GhostSection, GhostSectionList } from "./GhostSection";

describe("GhostSection", () => {
  it("adds the section from a keyboard-reachable button named after the section", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <GhostSectionList>
        <GhostSection title="Related work" description="Connect this dataset to papers." onAdd={onAdd} />
      </GhostSectionList>,
    );
    expect(screen.getByRole("region", { name: "Sections you can add" })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "Add Related work" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
