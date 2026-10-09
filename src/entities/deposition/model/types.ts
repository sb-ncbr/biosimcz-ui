import type { z } from "zod";
import type { draftSchema, runSchema, studySchema, systemSchema } from "./schema.draft";

type DepositionDraft = z.output<typeof draftSchema>;
type Study = z.output<typeof studySchema>;
type System = z.output<typeof systemSchema>;
type Run = z.output<typeof runSchema>;
type Creator = Study["authors"][number];
type Molecule = System["molecules"][number];

// A file of the server draft (E-D1). Its key is also listed in system.fileKeys or a run's fileKeys once committed.
type DraftFileInfo = { key: string; size: number; status: "pending" | "completed"; mimetype?: string };

// Everything the wizard needs to open a draft: values from the metadata plus server bookkeeping.
type DraftSnapshot = {
  id: string;
  status: "draft" | "published";
  // Set once the record has a DOI (after publishing).
  doi?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  draft: DepositionDraft;
  files: DraftFileInfo[];
};

export type { Creator, DepositionDraft, DraftFileInfo, DraftSnapshot, Molecule, Run, Study, System };
