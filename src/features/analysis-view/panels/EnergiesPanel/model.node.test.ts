import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { energiesSchema, parseWith, type EnergiesData } from "@/entities/analysis";
import { agentOf, effectiveSelection, energiesSummary, energyLines, hasLabels, interactionOptions, topContributors } from "./model";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "src/mocks/fixtures/mdposit/analyses", `${name}.json`), "utf8"));

const parsed = (): EnergiesData => {
  const result = parseWith(energiesSchema, load("energies-00"));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

const none = { interaction: null, agent: null, stage: null };

describe("energies model", () => {
  it("treats the captured per-atom payload as unlabelled atoms", () => {
    const data = parsed();
    const selection = effectiveSelection(data, none);
    expect(selection).toEqual({ interaction: "0", agent: "agent1", stage: "overall" });
    const agent = agentOf(data, selection);
    expect(hasLabels(agent)).toBe(false);
    const top = topContributors(agent, agent!.stages.overall);
    expect(top).toHaveLength(6);
    expect(top[0]!.label).toMatch(/^Atom \d+$/);
    expect(Math.abs(top[0]!.value)).toBeGreaterThanOrEqual(Math.abs(top[5]!.value));
  });

  it("stacks only electrostatic and VdW and keeps the sum as an unstacked line", () => {
    const agent = agentOf(parsed(), effectiveSelection(parsed(), none))!;
    const { stacked, plain } = energyLines(agent.stages.overall);
    expect(stacked.map((s) => ("stack" in s ? s.stack : undefined))).toEqual(["energy", "energy", undefined]);
    expect(stacked[2]!.name).toBe("Electrostatic + VdW");
    expect(plain.every((s) => !("stack" in s))).toBe(true);
  });

  it("falls back to a valid selection when the stored one is stale", () => {
    const data = parsed();
    expect(effectiveSelection(data, { interaction: "9", agent: "agent2", stage: "final" })).toEqual({
      interaction: "0",
      agent: "agent2",
      stage: "final",
    });
    expect(effectiveSelection(data, { interaction: "0", agent: "bogus", stage: "bogus" })).toMatchObject({ agent: "agent1", stage: "overall" });
    expect(effectiveSelection({ data: [] }, none).interaction).toBe("");
  });

  it("yields empty series for an agent without arrays instead of throwing", () => {
    const data = parsed();
    const empty: EnergiesData = {
      data: [{ ...data.data[0]!, agent2: { labels: [], stages: { overall: { es: [], vdw: [], both: [] }, initial: { es: [], vdw: [], both: [] }, final: { es: [], vdw: [], both: [] } } } }],
    };
    const agent = agentOf(empty, effectiveSelection(empty, { ...none, agent: "agent2" }))!;
    expect(energyLines(agent.stages.overall).samples).toBe(0);
    expect(topContributors(agent, agent.stages.overall)).toEqual([]);
  });

  it("lists interactions by index and summarises the selection", () => {
    const data = parsed();
    expect(interactionOptions(data)[0]).toMatchObject({ value: "0" });
    expect(energiesSummary("x", effectiveSelection(data, none), 5, undefined)).toBe("x, Agent 1, overall stage: 5 samples.");
  });
});
