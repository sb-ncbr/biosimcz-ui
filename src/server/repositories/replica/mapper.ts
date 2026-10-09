import "server-only";
import type { Quantity, ReplicaDetail, ReplicaRef } from "@/entities/replica";
import type { MdpositReplica } from "../../backends/mdposit/projectSchemas";

// Anti-corruption layer: MDposit replica payload -> ReplicaDetail. Every field is optional upstream, so absence stays null
// and a real 0 stays 0.

const finite = (value: number | null | undefined): Quantity => (typeof value === "number" && Number.isFinite(value) ? value : null);

const textOrNull = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

const textList = (value: string | readonly string[] | null | undefined): string[] => {
  const items = value === null || value === undefined ? [] : typeof value === "string" ? [value] : value;
  return [...new Set(items.flatMap((item) => textOrNull(item) ?? []))];
};

// A warning is plain text or an object whose text lives in a conventional key; anything else is shown as JSON, not dropped.
const WARNING_KEYS = ["message", "text", "warning", "description"] as const;

const warningText = (item: unknown): string | null => {
  if (typeof item === "string") return textOrNull(item);
  if (item === null || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  for (const key of WARNING_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return Object.keys(record).length === 0 ? null : JSON.stringify(record);
};

// null when no part is known, so "no nucleic acids" (0) differs from "not reported".
const sum = (...values: Quantity[]): Quantity => {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
};

const toReplicaDetail = (project: MdpositReplica, ref: ReplicaRef): ReplicaDetail => {
  const m = project.metadata ?? undefined;
  const cations = finite(m?.COUNCAT);
  const anions = finite(m?.COUNANI);
  return {
    ...ref,
    analyses: textList(project.analyses),
    forceFields: textList(m?.FF),
    waterModel: textOrNull(m?.WAT),
    frames: finite(m?.mdFrames),
    frameStepNs: finite(m?.FRAMESTEP),
    timestepFs: finite(m?.TIMESTEP),
    temperatureK: finite(m?.TEMP),
    ensemble: textOrNull(m?.ENSEMBLE),
    atoms: finite(m?.mdAtoms) ?? finite(m?.SYSTATS),
    dataType: textOrNull(m?.TYPE),
    // A string is one entry: "truncated octahedron" is a single type, so it is never split on spaces.
    box: { types: textList(m?.BOXTYPE), xNm: finite(m?.BOXSIZEX), yNm: finite(m?.BOXSIZEY), zNm: finite(m?.BOXSIZEZ) },
    composition: {
      total: { atoms: finite(m?.SYSTATS), residues: finite(m?.SYSTRES) },
      protein: { atoms: finite(m?.PROTATS), residues: finite(m?.PROTRES) },
      nucleic: { atoms: sum(finite(m?.DNAATS), finite(m?.RNAATS)), residues: sum(finite(m?.DNARES), finite(m?.RNARES)) },
      lipids: { atoms: finite(m?.LIPIATS), residues: finite(m?.LIPIRES) },
      carbohydrates: { atoms: finite(m?.CARBATS), residues: finite(m?.CARBRES) },
      solvent: { atoms: finite(m?.SOLVATS), residues: finite(m?.SOLVRES) },
    },
    ions: { cations, anions, total: finite(m?.COUNION) ?? sum(cations, anions) },
    warnings: (m?.WARNINGS ?? []).flatMap((item) => warningText(item) ?? []),
  };
};

export { toReplicaDetail };
