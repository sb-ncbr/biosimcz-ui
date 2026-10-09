import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReplicaRail } from "./ReplicaRail";

const segments = vi.hoisted(() => ({ value: [] as string[] }));
vi.mock("next/navigation", () => ({ useSelectedLayoutSegments: () => segments.value }));

const replicas = [
  { name: "replica_2", analyses: ["rmsd"] },
  { name: "replica_1", analyses: ["rmsd", "rgyr"] },
  { name: "other one", analyses: [] },
];

const renderRail = () => renderWithProviders(<ReplicaRail accession="MD-A00001" replicas={replicas} current="replica_1" />);
const hrefs = () => screen.getAllByRole("link").map((link) => link.getAttribute("href"));

describe("ReplicaRail", () => {
  beforeEach(() => {
    segments.value = [];
  });

  it("lists A-Z, marks the current replica and toggles to Z-A", async () => {
    renderRail();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["other one", "replica_1", "replica_2"]);
    expect(screen.getByRole("link", { name: "replica_1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "replica_2" })).not.toHaveAttribute("aria-current");
    await userEvent.click(screen.getByRole("button", { name: /sorted a to z/i }));
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["replica_2", "replica_1", "other one"]);
  });

  it("filters and shows the empty text", async () => {
    renderRail();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search replicas" }), "REPLICA_2");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "nothing");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("No replicas match your search.")).toBeInTheDocument();
  });

  it("keeps the tab and the analysis only when the target has it", () => {
    segments.value = ["analyses", "rgyr"];
    renderRail();
    expect(hrefs()).toEqual([
      "/records/MD-A00001/experiments/other%20one/analyses",
      "/records/MD-A00001/experiments/replica_1/analyses/rgyr",
      "/records/MD-A00001/experiments/replica_2/analyses",
    ]);
  });

  it("keeps the trajectory tab", () => {
    segments.value = ["trajectory"];
    renderRail();
    expect(hrefs()[0]).toBe("/records/MD-A00001/experiments/other%20one/trajectory");
  });
});
