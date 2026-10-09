import type { Run } from "@/entities/deposition";

type OptionalField = {
  // Path inside the run, as in the registry.
  path: string;
  label: string;
  kind: "select" | "number" | "integer";
  unit?: string;
  options?: readonly string[];
};

// Fields of the optional "Sections you can add" (191:608-658). TODO(backend): option lists are placeholders.
const OPTIONAL_FIELDS: Record<string, readonly OptionalField[]> = {
  electrostatics: [
    { path: "electrostatics.method", label: "Method", kind: "select", options: ["PME", "Reaction-field", "Cut-off"] },
    { path: "electrostatics.cutoffNm", label: "Cut-off", kind: "number", unit: "nm" },
  ],
  vanDerWaals: [
    { path: "vanDerWaals.method", label: "Method", kind: "select", options: ["Cut-off", "Force-switch", "Potential-switch"] },
    { path: "vanDerWaals.cutoffNm", label: "Cut-off", kind: "number", unit: "nm" },
  ],
  constraints: [
    { path: "constraints.algorithm", label: "Algorithm", kind: "select", options: ["LINCS", "SHAKE", "SETTLE"] },
    { path: "constraints.type", label: "Constrained bonds", kind: "select", options: ["none", "h-bonds", "all-bonds", "h-angles", "all-angles"] },
  ],
  enhancedSampling: [
    { path: "enhancedSampling.method", label: "Method", kind: "select", options: ["Umbrella sampling", "AWH", "Metadynamics", "Restraints"] },
  ],
  freeEnergy: [{ path: "freeEnergy.lambdaWindows", label: "Lambda windows", kind: "integer" }],
  motionRemoval: [
    { path: "motionRemoval.mode", label: "Mode", kind: "select", options: ["Linear", "Angular", "Linear-acceleration-correction", "None"] },
    { path: "motionRemoval.frequencySteps", label: "Frequency", kind: "integer", unit: "steps" },
  ],
};

// A section the user added counts as "filled" only when one of its values is set (removal asks before discarding those).
const sectionHasValues = (run: Run, key: keyof Run): boolean => {
  const value = run[key];
  return typeof value === "object" && value !== null && Object.values(value).some((item) => item !== undefined && item !== "");
};

export { OPTIONAL_FIELDS, sectionHasValues };
export type { OptionalField };
