import { formatQuantity, frequencyPs, simulationLengthNs, type Quantity, type ReplicaDetail } from "@/entities/replica";

const NOT_AVAILABLE = "N/A";

type Row = { label: string; value: string };
type CompositionRow = { label: string; atoms: string; residues: string };

const fixed = (digits: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const threeDecimals = fixed(3);
const twoDecimals = fixed(2);

const orNotAvailable = (value: string | null): string => value ?? NOT_AVAILABLE;

const quantity = (value: Quantity, unit?: string): string => orNotAvailable(formatQuantity(value, unit));

const fixedQuantity = (formatter: Intl.NumberFormat, value: Quantity, unit: string): string =>
  value === null || !Number.isFinite(value) ? NOT_AVAILABLE : `${formatter.format(value)} ${unit}`;

// The volume is only meaningful when all three edges are known; one missing edge must not yield a product with 0 or NaN.
const boxVolumeNm3 = ({ xNm, yNm, zNm }: ReplicaDetail["box"]): Quantity => (xNm === null || yNm === null || zNm === null ? null : xNm * yNm * zNm);

type ForceFieldRows = { forceFields: string[]; waterModel: string };

const forceFieldRows = (replica: ReplicaDetail): ForceFieldRows => ({
  forceFields: replica.forceFields,
  waterModel: orNotAvailable(replica.waterModel),
});

const simulationParameterRows = (replica: ReplicaDetail): Row[] => [
  { label: "Frames", value: quantity(replica.frames) },
  { label: "Frequency", value: quantity(frequencyPs(replica.frameStepNs), "ps") },
  { label: "Simulation length", value: quantity(simulationLengthNs(replica.frames, replica.frameStepNs), "ns") },
  { label: "Timestep", value: quantity(replica.timestepFs, "fs") },
  { label: "Temperature", value: quantity(replica.temperatureK, "K") },
  { label: "Ensemble", value: orNotAvailable(replica.ensemble) },
];

type BoxRows = { types: string[]; edges: Row[]; volume: Row };

const simulationBoxRows = (replica: ReplicaDetail): BoxRows => {
  const { box } = replica;
  return {
    types: [...new Set(box.types)],
    edges: [
      { label: "X", value: fixedQuantity(threeDecimals, box.xNm, "nm") },
      { label: "Y", value: fixedQuantity(threeDecimals, box.yNm, "nm") },
      { label: "Z", value: fixedQuantity(threeDecimals, box.zNm, "nm") },
    ],
    volume: { label: "Box volume", value: fixedQuantity(twoDecimals, boxVolumeNm3(box), "nm³") },
  };
};

const COMPOSITION_LABELS = [
  ["total", "Total system"],
  ["protein", "Protein"],
  ["nucleic", "Nucleic acids"],
  ["lipids", "Lipids"],
  ["carbohydrates", "Carbohydrates"],
  ["solvent", "Solvent"],
] as const;

const compositionRows = (replica: ReplicaDetail): CompositionRow[] =>
  COMPOSITION_LABELS.map(([key, label]) => ({
    label,
    atoms: quantity(replica.composition[key].atoms),
    residues: quantity(replica.composition[key].residues),
  }));

const counterIonRows = (replica: ReplicaDetail): Row[] => [
  { label: "Cations (+)", value: quantity(replica.ions.cations) },
  { label: "Anions (-)", value: quantity(replica.ions.anions) },
  { label: "Total ions", value: quantity(replica.ions.total) },
];

export { compositionRows, counterIonRows, forceFieldRows, NOT_AVAILABLE, simulationBoxRows, simulationParameterRows };
export type { BoxRows, CompositionRow, ForceFieldRows, Row };
