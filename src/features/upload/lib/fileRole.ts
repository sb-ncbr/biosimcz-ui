import { extensionOf } from "./keys";

type DetectedRole = "topology" | "structure_and_box" | "starting_structure" | "run_input" | "parameters" | "trajectory" | "other";

const BY_EXTENSION: Record<string, DetectedRole> = {
  ".top": "topology",
  ".itp": "topology",
  ".gro": "structure_and_box",
  ".pdb": "starting_structure",
  ".tpr": "run_input",
  ".mdp": "parameters",
  ".trj": "trajectory",
};

const ROLE_LABEL: Record<DetectedRole, string> = {
  topology: "Topology",
  structure_and_box: "Structure and box",
  starting_structure: "Starting structure",
  run_input: "Run input",
  parameters: "Parameters",
  trajectory: "Trajectory",
  other: "File",
};

// Client-side fallback so rows show a role even when the parse endpoint is missing or failed (plan 4.4).
const roleFromName = (name: string): DetectedRole => BY_EXTENSION[extensionOf(name)] ?? "other";

// Unknown backend roles are ignored so the extension fallback shows.
const toDetectedRole = (value: string | undefined): DetectedRole | undefined =>
  value !== undefined && value in ROLE_LABEL ? (value as DetectedRole) : undefined;

export { ROLE_LABEL, roleFromName, toDetectedRole };
export type { DetectedRole };
