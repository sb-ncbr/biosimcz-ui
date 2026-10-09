// Public constants only. Never put backend URLs or secrets here.
const APP_NAME = "MDRepo";

// Q5: limits and accepted types are unconfirmed by the backend. The server enforces its own UPLOAD_MAX_BYTES
// (env); this value only drives client-side pre-checks and copy, so keep the two in step.
const UPLOAD_LIMITS = {
  maxBytes: 52_428_800,
  concurrency: 3,
  systemExtensions: [".top", ".itp", ".gro", ".pdb", ".tpr"],
  experimentExtensions: [".tpr", ".trj", ".mdp"],
} as const;

export { APP_NAME, UPLOAD_LIMITS };
