import { ENERGY_STAGES, type EnergiesData, type EnergyAgent, type EnergySeries, type EnergyStage } from "@/entities/analysis";
import type { XY } from "@/shared/viewers/echarts";
import { effectiveChoice } from "../structuralCommon";

const AGENT_KEYS = ["agent1", "agent2"] as const;
type AgentKey = (typeof AGENT_KEYS)[number];

const MAX_TOP_CONTRIBUTORS = 6;

const AGENT_LABELS: Record<AgentKey, string> = { agent1: "Agent 1", agent2: "Agent 2" };
const STAGE_LABELS: Record<EnergyStage, string> = { overall: "Overall", initial: "Initial", final: "Final" };

type Selection = { interaction: string; agent: AgentKey; stage: EnergyStage };
type Chosen = { interaction: string | null; agent: string | null; stage: string | null };
type Contributor = { index: number; label: string; value: number };

const isAgentKey = (value: string): value is AgentKey => (AGENT_KEYS as readonly string[]).includes(value);
const isStage = (value: string): value is EnergyStage => (ENERGY_STAGES as readonly string[]).includes(value);

// Ids are indices: two interactions may share a name.
const interactionOptions = (data: EnergiesData): { value: string; label: string }[] =>
  data.data.map((entry, index) => ({ value: String(index), label: entry.name }));

const effectiveSelection = (data: EnergiesData, chosen: Chosen): Selection => {
  const interaction = effectiveChoice(chosen.interaction, data.data.map((_, i) => String(i)), null);
  const agent = effectiveChoice(chosen.agent, AGENT_KEYS, "agent1");
  const stage = effectiveChoice(chosen.stage, ENERGY_STAGES, "overall");
  return { interaction, agent: isAgentKey(agent) ? agent : "agent1", stage: isStage(stage) ? stage : "overall" };
};

const agentOf = (data: EnergiesData, selection: Selection): EnergyAgent | null => data.data[Number(selection.interaction)]?.[selection.agent] ?? null;

// Real payloads carry no labels (entries are per atom), so the 1-based position is the identity.
const hasLabels = (agent: EnergyAgent | null): boolean => (agent?.labels.length ?? 0) > 0;
const itemLabel = (agent: EnergyAgent | null, index: number): string => agent?.labels[index] || `${hasLabels(agent) ? "Residue" : "Atom"} ${index + 1}`;

const toPoints = (values: readonly number[]): XY[] => values.map((value, index): XY => [index + 1, value]);

// Only electrostatic and VdW are stacked; their sum is drawn as a separate line so it is not counted twice.
const energyLines = (series: EnergySeries) => {
  const es = toPoints(series.es);
  const vdw = toPoints(series.vdw);
  const both = toPoints(series.both);
  return {
    stacked: [
      { name: "Electrostatic", data: es, stack: "energy", area: true },
      { name: "Van der Waals", data: vdw, stack: "energy", area: true },
      { name: "Electrostatic + VdW", data: both },
    ],
    plain: [
      { name: "Electrostatic", data: es },
      { name: "Van der Waals", data: vdw },
      { name: "Electrostatic + VdW", data: both },
    ],
    samples: Math.max(es.length, vdw.length, both.length),
  };
};

const topContributors = (agent: EnergyAgent | null, series: EnergySeries, limit = MAX_TOP_CONTRIBUTORS): Contributor[] => {
  const indices = Array.from({ length: series.both.length }, (_, i) => i).filter((i) => Number.isFinite(series.both[i]!));
  indices.sort((a, b) => Math.abs(series.both[b]!) - Math.abs(series.both[a]!));
  return indices.slice(0, limit).map((index) => ({ index, label: itemLabel(agent, index), value: series.both[index]! }));
};

const energiesSummary = (name: string, selection: Selection, samples: number, top: Contributor | undefined): string => {
  const lead = `${name}, ${AGENT_LABELS[selection.agent]}, ${STAGE_LABELS[selection.stage].toLowerCase()} stage: ${samples} samples.`;
  return top ? `${lead} Strongest: ${top.label} at ${top.value.toFixed(2)}.` : lead;
};

export {
  AGENT_KEYS,
  AGENT_LABELS,
  STAGE_LABELS,
  agentOf,
  effectiveSelection,
  energiesSummary,
  energyLines,
  hasLabels,
  interactionOptions,
  topContributors,
};
export type { Chosen, Contributor, Selection };
