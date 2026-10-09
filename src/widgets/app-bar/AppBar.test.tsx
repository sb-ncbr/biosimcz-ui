import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AppBar } from "./AppBar";
import { initialsOf, newDepositionHref } from "./navigation";

const logout = vi.hoisted(() => vi.fn(async () => ({ redirectTo: "/login" })));
const clearAllMirrors = vi.hoisted(() => vi.fn(async () => undefined));
const hardNavigate = vi.hoisted(() => vi.fn());
const createDraft = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ value: "/depositions" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
// SignOutItem is real; only the server action and the full-page navigation are replaced.
vi.mock("@/features/auth/actions", () => ({ logout, signInWithEinfra: vi.fn() }));
vi.mock("@/features/auth/lib/navigate", () => ({ hardNavigate }));
vi.mock("@/features/draft", () => ({ clearAllMirrors }));
vi.mock("@/features/deposition-create/actions", () => ({ createDraft }));

const user = { id: "u1", email: "jana@example.org", displayName: "Jana Novakova" };

describe("AppBar", () => {
  beforeEach(() => {
    logout.mockClear();
    hardNavigate.mockClear();
    clearAllMirrors.mockClear();
    createDraft.mockReset();
    pathname.value = "/depositions";
  });

  it("marks the current section and shows the user chip when logged in", () => {
    renderWithProviders(<AppBar user={user} />);
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0]!;
    expect(within(nav).getByRole("link", { name: "My depositions" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Communities" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "New deposition" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New deposition" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account: Jana Novakova" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("shows Log in and routes New Deposition through login when logged out", () => {
    renderWithProviders(<AppBar user={null} />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "New deposition" })).toHaveAttribute("href", "/login?next=%2Fdepositions");
    expect(screen.queryByRole("button", { name: /^Account/ })).not.toBeInTheDocument();
  });

  it("creates a draft from New Deposition when logged in", async () => {
    createDraft.mockResolvedValue({ ok: true, value: null });
    const actor = userEvent.setup();
    renderWithProviders(<AppBar user={user} />);
    await actor.click(screen.getByRole("button", { name: "New deposition" }));
    expect(createDraft).toHaveBeenCalledOnce();
  });

  it("signs out from the account menu", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AppBar user={user} />);
    await actor.click(screen.getByRole("button", { name: "Account: Jana Novakova" }));
    await actor.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(clearAllMirrors).toHaveBeenCalledOnce();
    expect(clearAllMirrors.mock.invocationCallOrder[0]).toBeLessThan(logout.mock.invocationCallOrder[0]!);
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("signs out from the mobile menu and wipes the mirrors there too", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AppBar user={user} />);
    await actor.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    await actor.click(within(dialog).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(clearAllMirrors).toHaveBeenCalledOnce();
    expect(clearAllMirrors.mock.invocationCallOrder[0]).toBeLessThan(logout.mock.invocationCallOrder[0]!);
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("opens the mobile menu with the navigation links", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AppBar user={null} />);
    await actor.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByRole("link", { name: "Communities" })).toHaveAttribute("href", "/communities");
    expect(within(dialog).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });
});

describe("AppBar keyboard behavior", () => {
  it("opens the account menu with Enter, moves with arrows, and returns focus on Escape", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AppBar user={user} />);
    const trigger = screen.getByRole("button", { name: "Account: Jana Novakova" });
    trigger.focus();
    await actor.keyboard("{Enter}");
    const item = await screen.findByRole("menuitem", { name: "Sign out" });
    await actor.keyboard("{ArrowDown}");
    expect(item).toHaveFocus();
    await actor.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("navigates the language menu with arrows and returns focus on Escape", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AppBar user={null} />);
    const trigger = screen.getByRole("button", { name: "Language: English" });
    trigger.focus();
    await actor.keyboard("{ArrowDown}");
    expect(await screen.findByRole("menuitemradio", { name: "English" })).toHaveFocus();
    await actor.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("moves focus into the mobile menu on open and back to its trigger on Escape", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AppBar user={null} />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    await actor.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await actor.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });
});

describe("navigation helpers", () => {
  it("builds initials from name or email", () => {
    expect(initialsOf("Jana Novakova")).toBe("JN");
    expect(initialsOf("jana@example.org")).toBe("JE");
  });

  it("only sends anonymous users through login", () => {
    expect(newDepositionHref(true)).toBe("/depositions");
    expect(newDepositionHref(false)).toContain("/login?next=");
  });
});
