import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft, systemSchema, type DepositionDraft } from "@/entities/deposition";
import { createMemoryMirror, DraftProvider, useDraft } from "@/features/draft";
import type { UploadTransport } from "@/features/upload";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SystemStep } from "./SystemStep";
import { SystemUploadsProvider, useSystemUploadsContext } from "./SystemUploadsProvider";

vi.mock("next/navigation", () => ({ usePathname: () => "/depositions/d1/system" }));

beforeAll(() => {
  // Radix and cmdk use browser APIs jsdom does not implement.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ revision: 2, updatedAt: "2026-09-30T00:01:00Z" }), { status: 200 }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
  window.location.hash = "";
});
afterEach(() => vi.unstubAllGlobals());

const transportWith = (overrides: Partial<UploadTransport> = {}): UploadTransport => ({
  init: () => Promise.resolve(),
  putContent: async (_d, _k, _f, { onProgress }) => onProgress(1),
  commit: () => Promise.resolve(),
  parse: () => Promise.resolve({ status: "unsupported", fields: [] }),
  remove: () => Promise.resolve(),
  ...overrides,
});

const withSystem = (system: Record<string, unknown>): DepositionDraft => ({ ...emptyDraft(), system: systemSchema.parse(system) });

const Probe = () => {
  const { draft } = useDraft();
  const { uploads } = useSystemUploadsContext();
  return (
    <>
      <output data-testid="system">{JSON.stringify(draft.system)}</output>
      <output data-testid="in-flight">{String(uploads.hasActive)}</output>
    </>
  );
};

const tree = (draft: DepositionDraft, transport: UploadTransport, step = true) => (
    <DraftProvider
      userId="u1"
      mirror={createMemoryMirror()}
      initial={{
        id: "d1",
        status: "draft",
        revision: 1,
        createdAt: "2026-09-30T00:00:00Z",
        updatedAt: "2026-09-30T00:00:00Z",
        draft,
        files: [],
      }}
    >
      <SystemUploadsProvider options={{ transport }}>
        {step ? <SystemStep /> : <p>Step 1</p>}
        <Probe />
      </SystemUploadsProvider>
    </DraftProvider>
  );

const renderStep = (draft: DepositionDraft, transport: UploadTransport = transportWith()) => renderWithProviders(tree(draft, transport));

const systemNow = (): Record<string, unknown> => JSON.parse(screen.getByTestId("system").textContent ?? "{}") as Record<string, unknown>;

const drop = async (user: ReturnType<typeof userEvent.setup>, ...names: string[]) => {
  await user.upload(
    screen.getByTestId("dropzone-input"),
    names.map((name) => new File(["x"], name)),
  );
};

const topology = {
  status: "ok" as const,
  detectedRole: "topology",
  fields: [
    { path: "system.engine.name", value: "GROMACS" },
    { path: "system.forceField", value: "CHARMM36m" },
  ],
};

describe("SystemStep prefill", () => {
  it("fills empty fields with a source chip, keeps typed values and overwrites only after confirmation", async () => {
    const user = userEvent.setup();
    renderStep(withSystem({ forceField: "AMBER ff14SB" }), transportWith({ parse: () => Promise.resolve(topology) }));
    await drop(user, "topol.top");

    expect(await screen.findByText(/1 field filled in from topol.top/)).toBeInTheDocument();
    expect(screen.getByText(/Kept your value for Force field/)).toBeInTheDocument();
    expect(systemNow()).toMatchObject({
      engine: { name: "GROMACS" },
      forceField: "AMBER ff14SB",
      fieldSources: { "engine.name": "topol.top" },
    });
    expect(screen.getAllByText("from topol.top").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Use values from topol.top" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(systemNow()).toMatchObject({ forceField: "AMBER ff14SB" });
    await user.click(within(dialog).getByRole("button", { name: "Replace values" }));
    await waitFor(() => expect(systemNow()).toMatchObject({ forceField: "CHARMM36m" }));
    expect(screen.queryByText(/Kept your value/)).not.toBeInTheDocument();
  });

  it("keeps the values of every file when several are parsed at once", async () => {
    const user = userEvent.setup();
    const parse: UploadTransport["parse"] = (_d, key) =>
      Promise.resolve(
        key.endsWith(".gro")
          ? { status: "ok", detectedRole: "structure_and_box", fields: [{ path: "system.systemSize", value: 33940 }] }
          : { ...topology, fields: [...topology.fields, { path: "system.engine.version", value: "2023.1" }] },
      );
    renderStep(emptyDraft(), transportWith({ parse }));
    await drop(user, "conf.gro", "topol.top");
    await waitFor(() =>
      expect(systemNow()).toMatchObject({ systemSize: 33940, forceField: "CHARMM36m", engine: { name: "GROMACS", version: "2023.1" } }),
    );
    expect(screen.getAllByTestId("prefill-callout")).toHaveLength(2);
  });

  it("shows the unreadable callout and replaces the file", async () => {
    const user = userEvent.setup();
    const init = vi.fn(() => Promise.resolve());
    const parse = vi.fn<UploadTransport["parse"]>().mockResolvedValueOnce({ status: "unreadable", fields: [] }).mockResolvedValue(topology);
    renderStep(emptyDraft(), transportWith({ parse, init }));
    await drop(user, "topol.top");
    expect(await screen.findByText(/We could not read topol.top/)).toBeInTheDocument();

    await user.upload(screen.getByTestId("replace-input"), new File(["y"], "topol.top"));
    await waitFor(() => expect(systemNow()).toMatchObject({ engine: { name: "GROMACS" } }));
    expect(init).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/We could not read/)).not.toBeInTheDocument();
  });

  it("pauses uploads offline and resumes them on reconnect", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const putContent: UploadTransport["putContent"] = (_d, _k, _f, options) =>
      new Promise<void>((resolve, reject) => {
        release = resolve;
        options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    renderStep(emptyDraft(), transportWith({ putContent }));
    await drop(user, "conf.gro");
    await screen.findByText(/^Uploading/);

    act(() => {
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByText("Paused - waiting for connection")).toBeInTheDocument();

    act(() => {
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
    });
    await screen.findByText(/^Uploading/);
    await act(async () => release?.());
    await waitFor(() => expect(screen.getByText("Structure and box")).toBeInTheDocument());
  });
});

describe("SystemStep uploads across steps", () => {
  it("keeps an upload running when the step unmounts (navigating to Step 1 and back)", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    let aborted = false;
    const putContent: UploadTransport["putContent"] = (_d, _k, _f, options) =>
      new Promise<void>((resolve, reject) => {
        release = resolve;
        options.signal.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const transport = transportWith({ putContent });
    const draft = emptyDraft();
    const { rerender } = renderStep(draft, transport);
    await drop(user, "conf.gro");
    await screen.findByText(/^Uploading/);

    rerender(tree(draft, transport, false));
    expect(screen.getByTestId("in-flight")).toHaveTextContent("true");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await act(async () => release?.());
    await waitFor(() => expect(systemNow()["fileKeys"]).toEqual(["conf.gro"]));
    expect(aborted).toBe(false);

    rerender(tree(draft, transport, true));
    expect(await screen.findByText("Structure and box")).toBeInTheDocument();
    expect(screen.getByTestId("in-flight")).toHaveTextContent("false");
  });
});

describe("SystemStep dimensions", () => {
  it("shows box angles only for triclinic and custom boxes", () => {
    const { unmount } = renderStep(withSystem({ box: { shape: "cubic", a: 7, b: 7, c: 7 } }));
    expect(screen.queryByRole("group", { name: /Box angles/ })).not.toBeInTheDocument();
    expect(screen.getByText("Angles are fixed for this shape.")).toBeInTheDocument();
    unmount();
    renderStep(withSystem({ box: { shape: "triclinic", a: 7, b: 7, c: 7 } }));
    expect(screen.getByRole("group", { name: /Box angles/ })).toBeInTheDocument();
  });

  it("reveals the angles when the shape changes to triclinic and flags a format error", async () => {
    const user = userEvent.setup();
    renderStep(withSystem({ box: { shape: "cubic" } }));
    await user.click(screen.getByRole("combobox", { name: /Box shape/ }));
    await user.click(await screen.findByRole("option", { name: /Triclinic/ }));
    const angle = await screen.findByRole("textbox", { name: "Box angle α, degrees" });
    await user.type(angle, "200");
    await user.tab();
    expect(await screen.findByText("Angles must be between 0 and 180 degrees.")).toBeInTheDocument();
    expect(systemNow()).toMatchObject({ box: { shape: "triclinic" } });
  });
});

describe("SystemStep molecules", () => {
  const ligand = { type: "ligand", name: "N-acetylglucosamine", residueCode: "NAG", count: 2, parameters: "CGenFF" };

  it("edits a molecule in the dialog and saves it to the draft", async () => {
    const user = userEvent.setup();
    renderStep(withSystem({ molecules: [ligand] }));
    expect(screen.getByText("Ligand NAG - 2 copies - CGenFF")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions for N-acetylglucosamine" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const copies = within(dialog).getByRole("textbox", { name: /Copies/ });
    await user.clear(copies);
    await user.type(copies, "3");
    await user.click(within(dialog).getByRole("button", { name: "Save molecule" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Ligand NAG - 3 copies - CGenFF")).toBeInTheDocument();
    expect(systemNow()).toMatchObject({ molecules: [{ residueCode: "NAG", count: 3 }] });
  });

  it("validates required fields inside the dialog and asks before discarding edits", async () => {
    const user = userEvent.setup();
    renderStep(withSystem({ molecules: [ligand] }));
    await user.click(screen.getByRole("button", { name: "More actions for N-acetylglucosamine" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const code = within(dialog).getByRole("textbox", { name: /Residue code/ });
    await user.clear(code);
    await user.click(within(dialog).getByRole("button", { name: "Save molecule" }));
    expect(await within(dialog).findByText("Enter the residue code.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard changes to this molecule?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(systemNow()).toMatchObject({ molecules: [{ residueCode: "NAG" }] });
  });

  it("adds a molecule by hand", async () => {
    const user = userEvent.setup();
    renderStep(emptyDraft());
    expect(screen.getByText(/No molecules yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add molecule" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "Lysozyme C");
    await user.click(within(dialog).getByRole("button", { name: "Save molecule" }));
    await waitFor(() => expect(systemNow()).toMatchObject({ molecules: [{ type: "protein", name: "Lysozyme C" }] }));
  });
});

describe("SystemStep re-upload", () => {
  it("prefills the still empty version when the topology is uploaded again", async () => {
    const user = userEvent.setup();
    const parse: UploadTransport["parse"] = () =>
      Promise.resolve({ ...topology, fields: [...topology.fields, { path: "system.engine.version", value: "2023.1" }] });
    renderStep(withSystem({ engine: { name: "GROMACS", version: "" }, forceField: "CHARMM36m" }), transportWith({ parse }));
    await drop(user, "topol.top");
    expect(await screen.findByText(/1 field filled in from topol.top/)).toBeInTheDocument();
    expect(systemNow()).toMatchObject({ engine: { name: "GROMACS", version: "2023.1" } });
  });
});
