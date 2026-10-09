import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { TagInput } from "./TagInput";

// cmdk scrolls the active item into view, which jsdom does not implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const Harness = ({ initial = [] as string[], suggestions }: { initial?: string[]; suggestions?: string[] }) => {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <TagInput value={tags} onChange={setTags} suggestions={suggestions} label="Keywords" placeholder="Search or add keywords" />
      <output data-testid="tags">{tags.join("|")}</output>
    </>
  );
};

describe("TagInput", () => {
  it("adds typed text on Enter and ignores duplicates", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["lysozyme"]} />);
    const input = screen.getByRole("combobox", { name: "Keywords" });
    await user.type(input, "Lysozyme{Enter}");
    expect(screen.getByTestId("tags")).toHaveTextContent("lysozyme");
    await user.type(input, "protein dynamics{Enter}");
    expect(screen.getByTestId("tags")).toHaveTextContent("lysozyme|protein dynamics");
    expect(input).toHaveValue("");
  });

  it("adds on comma and removes with Backspace on empty input", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Keywords" });
    await user.type(input, "water,");
    expect(screen.getByTestId("tags")).toHaveTextContent("water");
    await user.keyboard("{Backspace}");
    expect(screen.getByTestId("tags")).toHaveTextContent("");
  });

  it("removes a tag with its labelled button", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["a", "b"]} />);
    await user.click(screen.getByRole("button", { name: "Remove a" }));
    expect(screen.getByTestId("tags")).toHaveTextContent("b");
  });

  it("offers suggestions and picks one with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness suggestions={["molecular dynamics", "membrane"]} />);
    const input = screen.getByRole("combobox", { name: "Keywords" });
    await user.type(input, "mem");
    expect(await screen.findByRole("option", { name: "membrane" })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("tags")).toHaveTextContent("membrane");
  });
});
