import "server-only";
import { sanitizeDraft, type Creator, type DepositionDraft, type Molecule, type Run } from "@/entities/deposition";

// Anti-corruption layer between the domain draft (camelCase, units implied) and the PROPOSED MDRepo metadata shape
// (backend-feature-requests section 3, snake_case with units in key names). The real schema is UNKNOWN (Q2), so this is
// the only file that changes when the backend answers.
// TODO(backend): fields below that the proposal does not list yet and that are marked "ext": system.size_atoms,
// system.file_keys, runs[].length_steps, temperature.groups, pressure.coupling_type, molecules[].ions.

type Json = Record<string, unknown>;

const obj = (value: unknown): Json | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : undefined;
const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const items = (value: unknown): Json[] => (Array.isArray(value) ? value.flatMap((item): Json[] => { const record = obj(item); return record ? [record] : []; }) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

// Drops undefined and null leaves so the wire JSON only carries what the user filled in.
const prune = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(prune);
  const record = obj(value);
  if (!record) return value;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, item]) => item !== undefined && item !== null)
      .map(([key, item]) => [key, prune(item)]),
  );
};

// ---- wire -> domain ---------------------------------------------------------------------------------------------

const creatorIn = (wire: Json): Creator =>
  ({
    kind: str(wire["kind"]),
    givenName: str(wire["given_name"]),
    familyName: str(wire["family_name"]),
    name: str(wire["name"]),
    role: str(wire["role"]),
    orcid: str(wire["orcid"]),
    rorId: str(wire["ror_id"]),
    affiliations: items(wire["affiliations"]).map((affiliation) => ({ name: str(affiliation["name"]) ?? "", rorId: str(affiliation["ror_id"]) })),
  }) as Creator;

const moleculeIn = (wire: Json): Molecule =>
  ({
    type: str(wire["type"]),
    name: str(wire["name"]),
    residueCode: str(wire["residue_code"]),
    count: num(wire["count"]),
    chains: Array.isArray(wire["chains"]) ? strings(wire["chains"]) : undefined,
    residues: num(wire["residues"]),
    parameters: str(wire["parameters"]),
    generatedWith: str(wire["generated_with"]),
    chargeMethod: str(wire["charge_method"]),
    concentrationMM: num(wire["concentration_mM"]),
    ions: Array.isArray(wire["ions"])
      ? items(wire["ions"]).map((ion) => ({ name: str(ion["name"]) ?? "", charge: num(ion["charge"]), count: num(ion["count"]) }))
      : undefined,
  }) as Molecule;

const runIn = (wire: Json): Run => {
  const temperature = obj(wire["temperature"]);
  const pressure = obj(wire["pressure"]);
  const electrostatics = obj(wire["electrostatics"]);
  const vanDerWaals = obj(wire["van_der_waals"]);
  const constraints = obj(wire["constraints"]);
  const enhancedSampling = obj(wire["enhanced_sampling"]);
  const freeEnergy = obj(wire["free_energy"]);
  const motionRemoval = obj(wire["motion_removal"]);
  const minimization = wire["simulation_type"] === "energy_minimization";
  return {
    id: str(wire["id"]),
    name: str(wire["name"]),
    simulationType: str(wire["simulation_type"]),
    ensemble: str(wire["ensemble"]),
    length: minimization ? (num(wire["length_steps"]) ?? num(wire["length_ns"])) : (num(wire["length_ns"]) ?? num(wire["length_steps"])),
    timeStep: num(wire["time_step_fs"]),
    outputInterval: num(wire["output_cadence_ps"]),
    temperature: temperature && {
      thermostat: str(temperature["coupling"]),
      referenceK: num(temperature["reference_K"]),
      couplingGroups: str(temperature["groups"]),
      tauPs: num(temperature["tau_ps"]),
    },
    pressure: pressure && {
      barostat: str(pressure["coupling"]),
      referenceBar: num(pressure["reference_bar"]),
      couplingType: str(pressure["coupling_type"]),
      tauPs: num(pressure["tau_ps"]),
    },
    electrostatics: electrostatics && { method: str(electrostatics["method"]), cutoffNm: num(electrostatics["cutoff_nm"]) },
    vanDerWaals: vanDerWaals && { method: str(vanDerWaals["method"]), cutoffNm: num(vanDerWaals["cutoff_nm"]) },
    constraints: constraints && { algorithm: str(constraints["algorithm"]), type: str(constraints["type"]) },
    enhancedSampling: enhancedSampling && { method: str(enhancedSampling["method"]) },
    freeEnergy: freeEnergy && { lambdaWindows: num(freeEnergy["lambda_windows"]) },
    motionRemoval: motionRemoval && { mode: str(motionRemoval["mode"]), frequencySteps: num(motionRemoval["frequency_steps"]) },
    fileKeys: strings(wire["file_keys"]),
  } as Run;
};

// Anything the backend sends that this app cannot represent (unknown enum values, wrong types) is dropped by
// sanitizeDraft instead of failing the whole page.
const fromExperimentMetadata = (json: unknown): DepositionDraft => {
  const meta = obj(json) ?? {};
  const study = obj(meta["study"]) ?? {};
  const system = obj(meta["system"]) ?? {};
  const embargo = obj(study["embargo"]);
  const engine = obj(system["engine"]);
  const structure = obj(system["starting_structure"]);
  const box = obj(system["box"]);
  const sources = obj(system["field_sources"]) ?? {};

  return sanitizeDraft({
    study: {
      title: str(study["title"]),
      doi: str(study["doi"]),
      description: str(study["description"]),
      keywords: strings(study["keywords"]),
      authors: items(study["authors"]).map(creatorIn),
      contributors: items(study["contributors"]).map(creatorIn),
      funding: items(study["funding"]).map((funding) => ({
        funderName: str(funding["funder_name"]),
        funderRorId: str(funding["funder_ror_id"]),
        awardNumber: str(funding["award_number"]),
        awardTitle: str(funding["award_title"]),
      })),
      communityId: strings(study["community_ids"])[0],
      access: str(study["access"]),
      embargo: embargo && { until: str(embargo["until"]), reason: str(embargo["reason"]) },
      license: str(study["license"]),
      relatedWorks: items(study["related_works"]).map((work) => ({
        identifier: str(work["identifier"]),
        scheme: str(work["scheme"]),
        relation: str(work["relation"]),
      })),
    },
    system: {
      engine: engine && { name: str(engine["name"]), version: str(engine["version"]), build: str(engine["build"]) },
      forceField: str(system["force_field"]),
      waterModel: str(system["water_model"]),
      startingStructure: structure && { source: str(structure["source"]), id: str(structure["id"]), title: str(structure["title"]) },
      molecules: items(system["molecules"]).map(moleculeIn),
      systemSize: num(system["size_atoms"]),
      box: box && {
        shape: str(box["shape"]),
        a: num(box["a_nm"]),
        b: num(box["b_nm"]),
        c: num(box["c_nm"]),
        alpha: num(box["alpha_deg"]),
        beta: num(box["beta_deg"]),
        gamma: num(box["gamma_deg"]),
      },
      fieldSources: Object.fromEntries(Object.entries(sources).flatMap(([path, file]) => (typeof file === "string" ? [[path, file]] : []))),
      fileKeys: strings(system["file_keys"]),
    },
    runs: items(meta["runs"]).map(runIn),
  });
};

// ---- domain -> wire ---------------------------------------------------------------------------------------------

const creatorOut = (creator: Creator): Json => ({
  kind: creator.kind,
  given_name: creator.givenName,
  family_name: creator.familyName,
  name: creator.name,
  role: creator.role,
  orcid: creator.orcid,
  ror_id: creator.rorId,
  affiliations: creator.affiliations.map((affiliation) => ({ name: affiliation.name, ror_id: affiliation.rorId })),
});

const runOut = (run: Run): Json => {
  const minimization = run.simulationType === "energy_minimization";
  return {
    id: run.id,
    name: run.name,
    simulation_type: run.simulationType,
    ensemble: run.ensemble,
    length_ns: minimization ? undefined : run.length,
    length_steps: minimization ? run.length : undefined,
    time_step_fs: run.timeStep,
    output_cadence_ps: run.outputInterval,
    temperature: run.temperature && {
      reference_K: run.temperature.referenceK,
      coupling: run.temperature.thermostat,
      groups: run.temperature.couplingGroups,
      tau_ps: run.temperature.tauPs,
    },
    pressure: run.pressure && {
      reference_bar: run.pressure.referenceBar,
      coupling: run.pressure.barostat,
      coupling_type: run.pressure.couplingType,
      tau_ps: run.pressure.tauPs,
    },
    electrostatics: run.electrostatics && { method: run.electrostatics.method, cutoff_nm: run.electrostatics.cutoffNm },
    van_der_waals: run.vanDerWaals && { method: run.vanDerWaals.method, cutoff_nm: run.vanDerWaals.cutoffNm },
    constraints: run.constraints && { algorithm: run.constraints.algorithm, type: run.constraints.type },
    enhanced_sampling: run.enhancedSampling && { method: run.enhancedSampling.method },
    free_energy: run.freeEnergy && { lambda_windows: run.freeEnergy.lambdaWindows },
    motion_removal: run.motionRemoval && { mode: run.motionRemoval.mode, frequency_steps: run.motionRemoval.frequencySteps },
    file_keys: run.fileKeys,
  };
};

const toExperimentMetadata = (draft: DepositionDraft): Json => {
  const { study, system } = draft;
  return prune({
    study: {
      title: study.title,
      doi: study.doi,
      description: study.description,
      keywords: study.keywords,
      authors: study.authors.map(creatorOut),
      contributors: study.contributors.map(creatorOut),
      funding: study.funding.map((funding) => ({
        funder_name: funding.funderName,
        funder_ror_id: funding.funderRorId,
        award_number: funding.awardNumber,
        award_title: funding.awardTitle,
      })),
      access: study.access,
      embargo: study.embargo && { until: study.embargo.until, reason: study.embargo.reason },
      license: study.license,
      community_ids: study.communityId ? [study.communityId] : [],
      related_works: study.relatedWorks.map((work) => ({ identifier: work.identifier, scheme: work.scheme, relation: work.relation })),
    },
    system: {
      engine: system.engine && { name: system.engine.name, version: system.engine.version, build: system.engine.build },
      force_field: system.forceField,
      water_model: system.waterModel,
      starting_structure: system.startingStructure && {
        source: system.startingStructure.source,
        id: system.startingStructure.id,
        title: system.startingStructure.title,
      },
      molecules: system.molecules.map((molecule) => ({
        type: molecule.type,
        name: molecule.name,
        residue_code: molecule.residueCode,
        count: molecule.count,
        chains: molecule.chains,
        residues: molecule.residues,
        parameters: molecule.parameters,
        generated_with: molecule.generatedWith,
        charge_method: molecule.chargeMethod,
        concentration_mM: molecule.concentrationMM,
        ions: molecule.ions,
      })),
      size_atoms: system.systemSize,
      box: system.box && {
        shape: system.box.shape,
        a_nm: system.box.a,
        b_nm: system.box.b,
        c_nm: system.box.c,
        alpha_deg: system.box.alpha,
        beta_deg: system.box.beta,
        gamma_deg: system.box.gamma,
      },
      field_sources: system.fieldSources,
      file_keys: system.fileKeys,
    },
    runs: draft.runs.map(runOut),
  }) as Json;
};

export { fromExperimentMetadata, toExperimentMetadata };
