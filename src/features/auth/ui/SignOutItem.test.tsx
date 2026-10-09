import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SignOutItem } from "./SignOutItem";

const order = vi.hoisted(() => ({ calls: [] as string[] }));
const logout = vi.hoisted(() => vi.fn(async () => ({ redirectTo: "https://idp.test/oidc/end_session?x=1" })));
const clearAllMirrors = vi.hoisted(() => vi.fn(async () => undefined));
const hardNavigate = vi.hoisted(() => vi.fn());

vi.mock("../actions", () => ({ logout, signInWithEinfra: vi.fn() }));
vi.mock("@/features/draft", () => ({ clearAllMirrors }));
vi.mock("../lib/navigate", () => ({ hardNavigate }));

beforeEach(() => {
  order.calls = [];
  logout.mockClear().mockImplementation(async () => {
    order.calls.push("logout");
    return { redirectTo: "https://idp.test/oidc/end_session?x=1" };
  });
  clearAllMirrors.mockClear().mockImplementation(async () => {
    order.calls.push("clearAllMirrors");
  });
  hardNavigate.mockClear();
});

describe("SignOutItem", () => {
  it("wipes the draft mirrors before the server action, then navigates to the returned URL", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<SignOutItem variant="button" />);
    await actor.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("https://idp.test/oidc/end_session?x=1"));
    expect(order.calls).toEqual(["clearAllMirrors", "logout"]);
  });

  it("is disabled while signing out", async () => {
    let release: () => void = () => undefined;
    logout.mockImplementation(() => new Promise((resolve) => (release = () => resolve({ redirectTo: "/login" }))));
    const actor = userEvent.setup();
    renderWithProviders(<SignOutItem variant="button" />);
    await actor.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled());
    release();
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });
});
