import type { DepositionDraft, Run } from "@/entities/deposition";
import { draftSchema } from "@/entities/deposition";

// A draft that satisfies every required rule; tests knock fields out of it.
const productionRun = (overrides: Partial<Run> = {}): Run => ({
  id: "run-production",
  name: "Production",
  simulationType: "molecular_dynamics",
  ensemble: "NpT",
  length: 100,
  timeStep: 2,
  temperature: { thermostat: "v-rescale", referenceK: 310 },
  pressure: { barostat: "c-rescale", referenceBar: 1 },
  fileKeys: ["md.tpr"],
  ...overrides,
});

const completeDraft = (): DepositionDraft =>
  draftSchema.parse({
    study: {
      title: "Lysozyme in water",
      description: "100 ns production run of hen egg-white lysozyme.",
      authors: [{ kind: "person", givenName: "Jana", familyName: "Novakova", affiliations: [] }],
      communityId: "community-1",
      access: "open",
      license: "cc-by-4.0",
    },
    system: {
      fileKeys: ["topol.top"],
      engine: { name: "GROMACS", version: "2023.1" },
      startingStructure: { source: "pdb", id: "1AKI", title: "Lysozyme C" },
      forceField: "CHARMM36m",
      systemSize: 33940,
      box: { shape: "cubic", a: 7.3, b: 7.3, c: 7.3 },
    },
    runs: [productionRun()],
  });

export { completeDraft, productionRun };
