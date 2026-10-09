import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { RendererEntry, ResolvedRenderer } from "../model/registry";

vi.mock("@/shared/viewers/echarts", () => ({
  ChartSkeleton: ({ height }: { height: number }) => <div role="status" aria-label="Loading chart" style={{ height }} />,
}));

const registry = vi.hoisted(() => ({ resolve: ((): ResolvedRenderer => null) as (name: string) => ResolvedRenderer }));
vi.mock("../model/registry", () => ({ resolveRenderer: (name: string) => registry.resolve(name) }));

const { AnalysisView, ANALYSIS_PANEL_HEIGHT } = await import("./AnalysisView");

type Payload = { value: number };

const entryWith = (Panel: RendererEntry<Payload>["Panel"]): ResolvedRenderer => ({
  base: "rgyr",
  entry: {
    bases: ["rgyr"],
    parse: (raw) =>
      typeof raw === "object" && raw !== null && "value" in raw
        ? { ok: true, data: raw as Payload }
        : { ok: false, issue: { path: "value", message: "missing" } },
    Panel,
  } as RendererEntry<unknown>,
});

const OkPanel = lazy(async () => ({ default: ({ data }: { data: Payload }) => <p>value {data.value}</p> }));
const CrashPanel = lazy(async () => ({
  default: () => {
    throw new Error("boom");
  },
}));

const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("AnalysisView", () => {
  beforeEach(() => {
    registry.resolve = () => entryWith(OkPanel);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows a skeleton at the final chart height, then the panel", async () => {
    vi.stubGlobal("fetch", respond({ value: 7 }));
    renderWithProviders(<AnalysisView instanceId="MD-A1.1" analysisName="rgyr" />);
    expect(screen.getByRole("status", { name: "Loading chart" })).toHaveStyle({ height: `${ANALYSIS_PANEL_HEIGHT}px` });
    expect(await screen.findByText("value 7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download JSON" })).toHaveAttribute("href", "/bff/records/MD-A1.1/analyses/rgyr");
  });

  it("offers a retry after a failed request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 404 })).mockResolvedValue(new Response(JSON.stringify({ value: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<AnalysisView instanceId="MD-A1.1" analysisName="rgyr" />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("value 1")).toBeInTheDocument();
  });

  it("names the parse failure and links the raw JSON", async () => {
    vi.stubGlobal("fetch", respond({ other: 1 }));
    renderWithProviders(<AnalysisView instanceId="MD-A1.1" analysisName="rgyr" />);
    expect(await screen.findByText("Data shape not recognised")).toBeInTheDocument();
    expect(screen.getByText(/at value/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download JSON" })).toBeInTheDocument();
  });

  it("shows the unsupported card without fetching", () => {
    registry.resolve = () => null;
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<AnalysisView instanceId="MD-A1.1" analysisName="rgyr" />);
    expect(screen.getByText("Preview not available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download JSON" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("contains a panel crash in its boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    registry.resolve = () => entryWith(CrashPanel as RendererEntry<Payload>["Panel"]);
    vi.stubGlobal("fetch", respond({ value: 1 }));
    renderWithProviders(<AnalysisView instanceId="MD-A1.1" analysisName="rgyr" />);
    await waitFor(() => expect(screen.getByText("This analysis failed to display.")).toBeInTheDocument());
    vi.restoreAllMocks();
  });
});
