// Format-error copy per field (missing-states 3.2). The schema only says that a value is wrong (stable codes such as
// not_positive, or a stock Zod message for text that is not a number), so each field owns one sentence.
const FIELD_COPY = {
  systemSize: "Enter a whole number greater than 0.",
  vectors: "Edge lengths must be numbers greater than 0.",
  angles: "Angles must be between 0 and 180 degrees.",
} as const;

const REQUIRED_COPY: Record<string, string> = {
  fileKeys: "Add at least one system file.",
  "engine.name": "Choose the engine.",
  "engine.version": "Choose the version.",
  startingStructure: "Choose a structure or mark it as custom.",
  forceField: "Choose a force field.",
  systemSize: "Enter the number of atoms.",
  "box.vectors": "Enter all three edge lengths.",
  "box.angles": "Enter all three angles.",
};

const errorCopy = (messages: readonly (string | undefined)[], copy: string): string | undefined =>
  messages.some((message) => message !== undefined) ? copy : undefined;

export { errorCopy, FIELD_COPY, REQUIRED_COPY };
