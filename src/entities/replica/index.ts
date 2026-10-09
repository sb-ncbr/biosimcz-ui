// Client-safe surface of the replica entity: types, URL helpers, pure helpers and the trajectory request schemas.
export { experimentsHref, replicaHref } from "./lib/href";
export { isAccession, resolveReplica } from "./lib/replicaRef";
export { formatQuantity, frequencyPs, simulationLengthNs } from "./lib/time";
export { estimateTrajectoryBytes } from "./lib/trajectorySize";
export { trajectoryRequestSchema } from "./model/trajectory";
export { REPLICA_TABS } from "./model/types";
export type { Quantity, ReplicaDetail, ReplicaRef, ReplicaTab } from "./model/types";
