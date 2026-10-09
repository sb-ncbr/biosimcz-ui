const REPLICA_TABS = ["overview", "trajectory", "analyses"] as const;
type ReplicaTab = (typeof REPLICA_TABS)[number];

type Quantity = number | null;

// instanceId is the MDposit project id of the replica ("MD-A007L3.1"); name is what the route shows.
type ReplicaRef = { accession: string; name: string; number: number; instanceId: string };

type ReplicaDetail = ReplicaRef & {
  analyses: string[];
  forceFields: string[];
  waterModel: string | null;
  frames: Quantity;
  frameStepNs: Quantity;
  timestepFs: Quantity;
  temperatureK: Quantity;
  ensemble: string | null;
  atoms: Quantity;
  dataType: string | null;
  box: { types: string[]; xNm: Quantity; yNm: Quantity; zNm: Quantity };
  composition: Record<
    "total" | "protein" | "nucleic" | "lipids" | "carbohydrates" | "solvent",
    { atoms: Quantity; residues: Quantity }
  >;
  ions: { cations: Quantity; anions: Quantity; total: Quantity };
  warnings: string[];
};

export { REPLICA_TABS };
export type { Quantity, ReplicaDetail, ReplicaRef, ReplicaTab };
