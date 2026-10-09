import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MolstarViewer } from "./MolstarViewer";

// Mol* needs WebGL and workers, so the whole library surface the facade touches is replaced.
const mocks = vi.hoisted(() => {
  const makePlugin = () => ({
    clear: vi.fn(async () => {}),
    dispose: vi.fn(),
    managers: { camera: { reset: vi.fn() } },
    canvas3d: undefined,
    helpers: {},
    builders: {
      data: { download: vi.fn<(params: { url: string }, options?: unknown) => Promise<object>>(async () => ({})), rawData: vi.fn(async () => ({})) },
      structure: { parseTrajectory: vi.fn(async () => ({})), hierarchy: { applyPreset: vi.fn(async () => ({})) } },
    },
  });
  return { makePlugin, createPluginUI: vi.fn(), loadTrajectory: vi.fn(async () => ({})) };
});

vi.mock("molstar/build/viewer/molstar.css", () => ({}));
vi.mock("molstar/lib/mol-plugin-ui", () => ({ createPluginUI: mocks.createPluginUI }));
vi.mock("molstar/lib/mol-plugin-ui/react18", () => ({ renderReact18: vi.fn() }));
vi.mock("molstar/lib/mol-plugin-ui/spec", () => ({ DefaultPluginUISpec: () => ({ components: {} }) }));
vi.mock("molstar/lib/mol-plugin/config", () => ({
  PluginConfig: {
    Viewport: Object.fromEntries(
      ["ShowControls", "ShowReset", "ShowExpand", "ShowToggleFullscreen", "ShowSelectionMode", "ShowSettings", "ShowAnimation", "ShowTrajectoryControls", "ShowScreenshotControls"].map(
        (key) => [key, key],
      ),
    ),
  },
}));
vi.mock("molstar/lib/extensions/plugin/loaders", () => ({ loadTrajectory: mocks.loadTrajectory }));

type FakePlugin = ReturnType<typeof mocks.makePlugin>;
let plugins: FakePlugin[] = [];
const first = (): FakePlugin => {
  const plugin = plugins[0];
  if (!plugin) throw new Error("plugin was not created");
  return plugin;
};

beforeEach(() => {
  plugins = [];
  mocks.loadTrajectory.mockClear();
  mocks.createPluginUI.mockReset();
  mocks.createPluginUI.mockImplementation(async () => {
    const plugin = mocks.makePlugin();
    plugins.push(plugin);
    return plugin;
  });
});

const xtc = new Uint8Array([1, 2, 3]);

describe("MolstarViewer", () => {
  it("loads a static structure, reports ready and keeps its status stream", async () => {
    const onStatus = vi.fn();
    render(<MolstarViewer structureUrl="/bff/records/MD-A.1/structure" title="Replica 1" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("ready", undefined));
    expect(first().builders.data.download).toHaveBeenCalledWith({ url: "/bff/records/MD-A.1/structure", isBinary: false }, expect.anything());
    expect(onStatus.mock.calls.map(([status]) => status)).toEqual(["loading", "ready"]);
  });

  it("swaps static structure for a trajectory inside the same plugin", async () => {
    const onStatus = vi.fn();
    const { rerender } = render(<MolstarViewer structureUrl="/s" title="t" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("ready", undefined));
    rerender(<MolstarViewer structureUrl="/s" title="t" coordinates={{ data: xtc, format: "xtc" }} onStatus={onStatus} />);
    await waitFor(() => expect(mocks.loadTrajectory).toHaveBeenCalledTimes(1));
    expect(mocks.createPluginUI).toHaveBeenCalledTimes(1);
    expect(first().dispose).not.toHaveBeenCalled();
    expect(first().clear).toHaveBeenCalledTimes(2);
    expect(mocks.loadTrajectory).toHaveBeenCalledWith(
      first(),
      expect.objectContaining({ model: { kind: "model-url", url: "/s", format: "pdb", isBinary: false }, coordinates: { kind: "coordinates-data", data: xtc, format: "xtc" } }),
    );
  });

  it("uses in-memory model text for the trajectory when given", async () => {
    render(<MolstarViewer structureUrl={null} model={{ data: "ATOM", format: "pdb" }} coordinates={{ data: xtc, format: "xtc" }} title="t" />);
    await waitFor(() => expect(mocks.loadTrajectory).toHaveBeenCalled());
    expect(mocks.loadTrajectory).toHaveBeenCalledWith(first(), expect.objectContaining({ model: { kind: "model-data", data: "ATOM", format: "pdb" } }));
  });

  it("ignores a stale result when props change quickly", async () => {
    const onStatus = vi.fn();
    const { rerender } = render(<MolstarViewer structureUrl="/a" title="t" onStatus={onStatus} />);
    rerender(<MolstarViewer structureUrl="/b" title="t" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("ready", undefined));
    const urls = first().builders.data.download.mock.calls.map(([arg]) => arg.url);
    expect(urls.at(-1)).toBe("/b");
    expect(mocks.createPluginUI).toHaveBeenCalledTimes(1);
  });

  it("stays idle without a source", async () => {
    const onStatus = vi.fn();
    render(<MolstarViewer structureUrl={null} title="t" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("idle", undefined));
    expect(first().builders.data.download).not.toHaveBeenCalled();
  });

  it("shows only the fixed error message and retries through onRetry", async () => {
    const onStatus = vi.fn();
    const onRetry = vi.fn();
    mocks.createPluginUI.mockImplementationOnce(async () => {
      const plugin = mocks.makePlugin();
      plugin.builders.data.download.mockRejectedValueOnce(new Error("HTTP 500"));
      plugins.push(plugin);
      return plugin;
    });
    render(<MolstarViewer structureUrl="/s" title="t" onStatus={onStatus} onRetry={onRetry} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The 3D structure could not be loaded.");
    expect(alert).not.toHaveTextContent("HTTP 500");
    expect(onStatus).toHaveBeenCalledWith("error", { message: "The 3D structure could not be loaded." });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("ready", undefined));
    expect(first().dispose).toHaveBeenCalled();
  });

  it("reports a plugin creation failure", async () => {
    mocks.createPluginUI.mockRejectedValueOnce(new Error("no webgl"));
    render(<MolstarViewer structureUrl="/s" title="t" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The 3D structure could not be loaded.");
    expect(alert).not.toHaveTextContent("no webgl");
  });

  it("disposes the plugin on unmount", async () => {
    const onStatus = vi.fn();
    const { unmount } = render(<MolstarViewer structureUrl="/s" title="t" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("ready", undefined));
    unmount();
    expect(first().dispose).toHaveBeenCalledTimes(1);
  });

  it("renders its own toolbar only in the minimal variant", async () => {
    const { rerender } = render(<MolstarViewer structureUrl="/s" title="t" />);
    expect(screen.getByRole("button", { name: "Reset camera" })).toBeInTheDocument();
    rerender(<MolstarViewer structureUrl="/s" title="t" variant="full" />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Reset camera" })).not.toBeInTheDocument());
  });
});
