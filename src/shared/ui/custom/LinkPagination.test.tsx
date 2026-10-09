import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LinkPagination, pageWindow } from "./LinkPagination";

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it("keeps first, last and two either side, with gaps", () => {
    expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 18, 19, 20]);
  });
});

describe("LinkPagination", () => {
  const hrefFor = (page: number) => `/records?page=${page}`;

  it("renders nothing for a single page", () => {
    const { container } = renderWithProviders(<LinkPagination page={1} pages={1} hrefFor={hrefFor} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders real links and marks the current page", () => {
    renderWithProviders(<LinkPagination page={2} pages={5} hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("href", "/records?page=3");
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
  });

  it("hides Previous on the first page and Next on the last", () => {
    const { unmount } = renderWithProviders(<LinkPagination page={1} pages={3} hrefFor={hrefFor} />);
    expect(screen.queryByRole("link", { name: /previous page/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /next page/i })).toBeInTheDocument();
    unmount();
    renderWithProviders(<LinkPagination page={3} pages={3} hrefFor={hrefFor} />);
    expect(screen.queryByRole("link", { name: /next page/i })).not.toBeInTheDocument();
  });

  it("navigates on a plain click through onNavigate", async () => {
    const onNavigate = vi.fn();
    renderWithProviders(<LinkPagination page={1} pages={3} hrefFor={hrefFor} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("link", { name: "2" }));
    expect(onNavigate).toHaveBeenCalledWith(2);
  });
});
