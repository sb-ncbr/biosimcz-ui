import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SimulationType } from "@/entities/deposition";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { PublishModel, WizardNavModel } from "../model/types";
import { WizardShell } from "./WizardShell";

const nav = vi.hoisted(() => ({ pathname: "/depositions/d1/study", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

const model = (overrides: Partial<WizardNavModel> = {}): WizardNavModel => ({
  backHref: "/depositions",
  draft: { title: "Lysozyme in water", save: { kind: "saved", label: "Saved just now" } },
  steps: [
    { id: "study", label: "Study details", href: "/depositions/d1/study", status: "done", requiredLeft: 0, optionalLeft: 0 },
    { id: "system", label: "Molecular system", href: "/depositions/d1/system", status: "done", requiredLeft: 0, optionalLeft: 5 },
    {
      id: "experiments",
      label: "Experiments",
      href: "/depositions/d1/experiments",
      status: "partial",
      requiredLeft: 2,
      optionalLeft: 0,
      runs: [
        { id: "min", label: "Minimization", href: "/depositions/d1/experiments/min", status: "done", requiredLeft: 0, optionalLeft: 2 },
        { id: "prod", label: "Production", href: "/depositions/d1/experiments/prod", status: "partial", requiredLeft: 1, optionalLeft: 0 },
      ],
    },
  ],
  review: { href: "/depositions/d1/review", ready: false },
  ...overrides,
});

const blocked: PublishModel = { state: "blocked", reason: "Fill in 2 required fields to publish", blockedHref: "/depositions/d1/review" };

type ShellProps = {
  nav?: WizardNavModel;
  publish?: PublishModel;
  onPublish?: () => void;
  onBlockedPublish?: () => void;
  onAddRun?: (type: SimulationType) => void;
};

const renderShell = (props: ShellProps = {}) =>
  renderWithProviders(
    <WizardShell
      nav={props.nav ?? model()}
      publish={props.publish ?? blocked}
      onPublish={props.onPublish}
      onBlockedPublish={props.onBlockedPublish}
      onAddRun={"onAddRun" in props ? props.onAddRun : () => {}}
    >
      <h1>Page</h1>
    </WizardShell>,
  );

// The fixed sidebar and the Steps sheet render the same body; the desktop one is the always-mounted <aside>.
const sidebar = () => within(screen.getByRole("complementary", { name: "Deposition sidebar" }));

beforeEach(() => {
  nav.pathname = "/depositions/d1/study";
  nav.push.mockClear();
});

describe("WizardShell sidebar", () => {
  it("lists steps, nested runs, Add run and an always visible Review and publish", () => {
    renderShell();
    const steps = sidebar().getByRole("navigation", { name: "Deposition steps" });
    expect(within(steps).getByRole("link", { name: /Study details/ })).toBeInTheDocument();
    const runs = within(steps).getByRole("list", { name: "Experiments runs" });
    expect(within(runs).getByRole("link", { name: /Minimization/ })).toBeInTheDocument();
    expect(within(runs).getByRole("link", { name: /Production/ })).toBeInTheDocument();
    expect(within(runs).getByRole("button", { name: "Add run" })).toBeInTheDocument();
    expect(within(steps).getByRole("link", { name: /Review and publish/ })).toHaveAttribute("href", "/depositions/d1/review");
  });

  it("marks only the current page and shows required and optional meta", () => {
    nav.pathname = "/depositions/d1/experiments/prod";
    renderShell();
    const current = sidebar().getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Production");
    expect(sidebar().getByText("2 required")).toBeInTheDocument();
    expect(sidebar().getByText("+ 5 optional")).toBeInTheDocument();
    expect(sidebar().getByLabelText("1 required field left")).toBeInTheDocument();
    expect(sidebar().getByText("+ 2")).toBeInTheDocument();
  });

  it("gives every status icon a text alternative", () => {
    renderShell();
    expect(sidebar().getAllByRole("img", { name: "Complete" }).length).toBeGreaterThan(0);
    expect(sidebar().getAllByRole("img", { name: "In progress" }).length).toBeGreaterThan(0);
  });

  it("replaces the required pill with a to-fix badge and shows Ready on the review link", () => {
    const base = model();
    const first = base.steps[0]!;
    renderShell({
      nav: { ...base, steps: [{ ...first, requiredLeft: 1, toFix: 3 }, ...base.steps.slice(1)], review: { ...base.review, ready: true } },
    });
    expect(sidebar().getByText("3 to fix")).toBeInTheDocument();
    expect(sidebar().getByText("Ready")).toBeInTheDocument();
  });

  it("falls back to an italic Unnamed deposition and a saving indicator", () => {
    renderShell({ nav: model({ draft: { title: null, save: { kind: "saving" } } }) });
    expect(sidebar().getByText("Unnamed deposition")).toBeInTheDocument();
    expect(sidebar().getByText("Saving...")).toBeInTheDocument();
    expect(sidebar().getByRole("link", { name: "Back to My depositions" })).toHaveAttribute("href", "/depositions");
  });

  it("announces failures in the polite live region but not routine saves", () => {
    const { unmount } = renderShell();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    unmount();
    renderShell({ nav: model({ draft: { title: "x", save: { kind: "offline" } } }) });
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
  });
});

describe("Add run", () => {
  it("opens the run type menu and hands the chosen type to onAddRun", async () => {
    const onAddRun = vi.fn();
    renderShell({ onAddRun });
    await userEvent.click(sidebar().getByRole("button", { name: "Add run" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Molecular dynamics/ }));
    expect(onAddRun).toHaveBeenCalledWith("molecular_dynamics");
  });

  it("is not rendered when nothing handles it", () => {
    renderShell({ onAddRun: undefined });
    expect(sidebar().queryByRole("button", { name: "Add run" })).not.toBeInTheDocument();
  });

  it("closes the Steps sheet after a run was added from it", async () => {
    const onAddRun = vi.fn();
    renderShell({ onAddRun });
    await userEvent.click(screen.getByRole("button", { name: /Steps/ }));
    const dialog = await screen.findByRole("dialog", { name: "Steps" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Add run" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Energy minimization/ }));
    expect(onAddRun).toHaveBeenCalledWith("energy_minimization");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ActionBar", () => {
  it("tells the owner when a blocked Publish was clicked", async () => {
    const onBlockedPublish = vi.fn();
    renderShell({ onBlockedPublish });
    await userEvent.click(screen.getByRole("button", { name: /Publish/ }));
    expect(onBlockedPublish).toHaveBeenCalledOnce();
  });

  it("keeps a blocked Publish focusable, explains why, and sends the click to review", async () => {
    renderShell();
    const publish = screen.getByRole("button", { name: /Publish/ });
    expect(publish).toHaveAttribute("aria-disabled", "true");
    expect(publish).not.toBeDisabled();
    expect(publish).toHaveAccessibleDescription("Fill in 2 required fields to publish");
    await userEvent.click(publish);
    expect(nav.push).toHaveBeenCalledWith("/depositions/d1/review");
  });

  it("does not navigate when already on the review page", async () => {
    nav.pathname = "/depositions/d1/review";
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: /Publish/ }));
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("calls onPublish only when ready", async () => {
    const onPublish = vi.fn();
    const { unmount } = renderShell({ onPublish });
    await userEvent.click(screen.getByRole("button", { name: /Publish/ }));
    expect(onPublish).not.toHaveBeenCalled();
    unmount();
    renderShell({ onPublish, publish: { state: "ready" } });
    const publish = screen.getByRole("button", { name: /Publish/ });
    expect(publish).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(publish);
    expect(onPublish).toHaveBeenCalledOnce();
  });

  it("shows a busy label while publishing", () => {
    renderShell({ publish: { state: "publishing" } });
    expect(screen.getByRole("button", { name: "Publishing..." })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Steps sheet (below lg)", () => {
  it("opens from the top bar, lists the same steps, and closes on selection", async () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: /Steps/ });
    expect(trigger).toHaveTextContent("2 required");
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Steps" });
    const link = within(dialog).getByRole("link", { name: /Molecular system/ });
    expect(within(dialog).getByRole("link", { name: /Review and publish/ })).toBeInTheDocument();
    await userEvent.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves focus to the current step on open and back to the trigger on close", async () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: /Steps/ });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Steps" });
    expect(within(dialog).getByRole("link", { name: /Study details/ })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(trigger).toHaveFocus();
  });

  it("focuses the sheet title when no step is current", async () => {
    nav.pathname = "/elsewhere";
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: /Steps/ }));
    const dialog = await screen.findByRole("dialog", { name: "Steps" });
    expect(within(dialog).getByRole("heading", { name: "Steps" })).toHaveFocus();
  });

  it("returns focus to the Steps button when closed with Escape", async () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: /Steps/ });
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Steps" });
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });
});

describe("focus order", () => {
  it("puts the skip link first and targets the main landmark", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#wizard-main");
    expect(document.getElementById("wizard-main")).toBe(screen.getByRole("main"));
    expect(document.body.querySelector("a, button")).toBe(skip);
  });
});
