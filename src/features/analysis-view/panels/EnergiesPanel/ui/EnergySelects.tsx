"use client";

import { ENERGY_STAGES } from "@/entities/analysis";
import { PanelSelect } from "../../PanelSelect";
import { AGENT_KEYS, AGENT_LABELS, STAGE_LABELS, type Chosen, type Selection } from "../model";

type EnergySelectsProps = {
  interactions: readonly { value: string; label: string }[];
  selection: Selection;
  onChange: (patch: Partial<Chosen>) => void;
};

const AGENT_OPTIONS = AGENT_KEYS.map((key) => ({ value: key, label: AGENT_LABELS[key] }));
const STAGE_OPTIONS = ENERGY_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }));

// Rendered outside every data-dependent branch, so an empty agent or stage can always be switched away from.
function EnergySelects({ interactions, selection, onChange }: EnergySelectsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <PanelSelect label="Interaction" value={selection.interaction} options={interactions} onChange={(interaction) => onChange({ interaction })} />
      <PanelSelect label="Agent" value={selection.agent} options={AGENT_OPTIONS} onChange={(agent) => onChange({ agent })} />
      <PanelSelect label="Stage" value={selection.stage} options={STAGE_OPTIONS} onChange={(stage) => onChange({ stage })} />
    </div>
  );
}

export { EnergySelects };
