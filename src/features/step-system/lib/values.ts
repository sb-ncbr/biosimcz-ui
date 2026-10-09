import { systemSchema, type System } from "@/entities/deposition";
import type { z } from "zod";

// The parts of `system` the form edits. fileKeys (uploads) and fieldSources (prefill provenance) are written by the
// step itself, never by inputs.
const systemFormSchema = systemSchema.pick({
  engine: true,
  forceField: true,
  startingStructure: true,
  molecules: true,
  systemSize: true,
  box: true,
});

type SystemFormInput = z.input<typeof systemFormSchema>;
type SystemFormOutput = z.output<typeof systemFormSchema>;

const pickOwned = (system: System): SystemFormInput => ({
  ...(system.engine && { engine: system.engine }),
  ...(system.forceField !== undefined && { forceField: system.forceField }),
  ...(system.startingStructure && {
    startingStructure: system.startingStructure,
  }),
  molecules: system.molecules,
  ...(system.systemSize !== undefined && { systemSize: system.systemSize }),
  ...(system.box && { box: system.box }),
});

export { pickOwned, systemFormSchema };
export type { SystemFormInput, SystemFormOutput };
