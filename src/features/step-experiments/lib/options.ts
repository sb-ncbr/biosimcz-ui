import { SIMULATION_TYPES, SIMULATION_TYPE_LABELS, type Ensemble, type SimulationType } from "@/entities/deposition";

// TODO(backend): thermostat, barostat and coupling lists are placeholders until the backend publishes them.
const THERMOSTATS = ["V-rescale", "Nose-Hoover", "Berendsen", "Andersen", "Langevin"] as const;
const BAROSTATS = ["C-rescale", "Parrinello-Rahman", "Berendsen", "MTTK"] as const;
const COUPLING_TYPES = ["Isotropic", "Semi-isotropic", "Anisotropic", "Surface-tension"] as const;

const ENSEMBLE_HINTS: Record<Ensemble, string> = {
  NVE: "Constant particles, volume and energy.",
  NVT: "Constant particles, volume and temperature.",
  NpT: "Constant particles, pressure and temperature.",
};

// Sub lines of the "Add run" menu (186:1099, 197:23).
const TYPE_MENU: readonly { type: SimulationType; label: string; hint: string }[] = SIMULATION_TYPES.map((type) => ({
  type,
  label: SIMULATION_TYPE_LABELS[type],
  hint: {
    energy_minimization: "Relax the structure before dynamics",
    molecular_dynamics: "Equilibration or production",
    free_energy: "Lambda windows, decoupling",
  }[type],
}));

export { BAROSTATS, COUPLING_TYPES, ENSEMBLE_HINTS, THERMOSTATS, TYPE_MENU };
