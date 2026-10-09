// Copy for the run editor (missing-states 3.2). The schema reports only stable codes, so each field owns one sentence.
const REQUIRED_COPY: Record<string, string> = {
  fileKeys: "Add at least one experiment file.",
  name: "Name the run.",
  simulationType: "Choose the simulation type.",
  ensemble: "Choose the ensemble.",
  length: "Enter how long the run was.",
  timeStep: "Enter the time step.",
  "temperature.thermostat": "Choose the thermostat.",
  "temperature.referenceK": "Enter the reference temperature.",
  "pressure.barostat": "Choose the barostat.",
  "pressure.referenceBar": "Enter the reference pressure.",
};

const NUMBER_COPY = "Enter a number greater than 0.";
const INTEGER_COPY = "Enter a whole number greater than 0.";

const errorCopy = (message: string | undefined, copy: string): string | undefined => (message === undefined ? undefined : copy);

export { errorCopy, INTEGER_COPY, NUMBER_COPY, REQUIRED_COPY };
