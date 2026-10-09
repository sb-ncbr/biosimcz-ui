import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReplicaDetail } from "@/entities/replica";
import { renderWithProviders } from "@/test/renderWithProviders";
import { TrajectoryWorkbench } from "./TrajectoryWorkbench";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/records/MD-A/experiments/replica_1/trajectory",
  useSearchParams: () => new URLSearchParams("frames=1:20&selection=protein"),
}));

const viewer = vi.hoisted(() => ({ props: [] as unknown[] }));
vi.mock("@/shared/viewers/molstar", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  StructureViewer: (props: unknown) => {
    viewer.props.push(props);
    return <div data-testid="viewer" />;
  },
}));

const none = { atoms: null, residues: null };
const replica: ReplicaDetail = {
  accession: "MD-A",
  name: "replica_1",
  number: 1,
  instanceId: "MD-A.1",
  analyses: [],
  forceFields: [],
  waterModel: null,
  frames: 100,
  frameStepNs: 0.1,
  timestepFs: null,
  temperatureK: null,
  ensemble: null,
  atoms: 100,
  dataType: "trajectory",
  box: { types: [], xNm: null, yNm: null, zNm: null },
  composition: { total: none, protein: none, nucleic: none, lipids: none, carbohydrates: none, solvent: none },
  ions: { cations: null, anions: null, total: null },
  warnings: [],
};

afterEach(() => vi.restoreAllMocks());

describe("TrajectoryWorkbench", () => {
  it("prefills the form from the URL, loads the structure with the selection and does not download", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithProviders(<TrajectoryWorkbench replica={replica} />);
    expect(screen.getByLabelText("Frame window")).toHaveValue("1:20");
    expect(screen.getByLabelText("Selection (optional)")).toHaveValue("protein");
    expect(viewer.props.at(-1)).toMatchObject({ structureUrl: "/bff/records/MD-A.1/structure?selection=protein", variant: "full", height: 700 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits the request: writes the URL and downloads with the same window and selection", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const user = userEvent.setup();
    renderWithProviders(<TrajectoryWorkbench replica={replica} />);
    await user.click(screen.getByRole("button", { name: "Load trajectory" }));
    expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("frames=1%3A20"), { scroll: false });
    expect(fetchSpy).toHaveBeenCalledWith("/bff/records/MD-A.1/trajectory?frames=1%3A20&selection=protein", expect.anything());
    await vi.waitFor(() => expect(viewer.props.at(-1)).toMatchObject({ coordinates: { format: "xtc" } }));
  });

  it("shows the server problem by message key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ kind: "http", status: 429, messageKey: "errors.http.too_many_streams" }), {
        status: 429,
        headers: { "Retry-After": "5" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TrajectoryWorkbench replica={replica} />);
    await user.click(screen.getByRole("button", { name: "Load trajectory" }));
    expect(await screen.findByText(/busy with other trajectory downloads\. Try again in 5 seconds/)).toBeInTheDocument();
  });
});
