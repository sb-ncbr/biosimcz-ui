import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AppBar } from "./AppBar";

const pathname = vi.hoisted(() => ({ value: "/depositions" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/features/auth/actions", () => ({ logout: vi.fn(), signInWithEinfra: vi.fn() }));
vi.mock("@/features/auth/lib/navigate", () => ({ hardNavigate: vi.fn() }));
vi.mock("@/features/draft", () => ({ clearAllMirrors: vi.fn(async () => undefined) }));
vi.mock("@/features/deposition-create/actions", () => ({ createDraft: vi.fn() }));

beforeEach(() => {
  pathname.value = "/depositions";
});

describe("AppBar search", () => {
  it("shows the compact search on other pages", () => {
    renderWithProviders(<AppBar user={null} />);
    expect(screen.getByRole("search")).toHaveAttribute("action", "/records");
  });

  it("hides it on /records, which is the search page", () => {
    pathname.value = "/records";
    renderWithProviders(<AppBar user={null} />);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("marks Browse as current only on the search page", () => {
    pathname.value = "/records";
    renderWithProviders(<AppBar user={null} />);
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(nav).toBeDefined();
    expect(within(nav as HTMLElement).getByRole("link", { name: "Browse" })).toHaveAttribute("aria-current", "page");
    expect(within(nav as HTMLElement).getByRole("link", { name: "My depositions" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the compact search and no current Browse mark on a record page", () => {
    pathname.value = "/records/MD-A00005";
    renderWithProviders(<AppBar user={null} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(nav as HTMLElement).getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/records");
    expect(within(nav as HTMLElement).getByRole("link", { name: "Browse" })).not.toHaveAttribute("aria-current");
  });
});

describe("AppBar on the homepage", () => {
  it("keeps the compact search and does not mark Browse as current", () => {
    pathname.value = "/";
    renderWithProviders(<AppBar user={null} />);
    expect(screen.getByRole("search")).toHaveAttribute("action", "/records");
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(nav as HTMLElement).getByRole("link", { name: "Browse" })).not.toHaveAttribute("aria-current");
  });
});
