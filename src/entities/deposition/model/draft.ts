import { draftSchema } from "./schema.draft";
import type { DepositionDraft, Run } from "./types";

const emptyDraft = (): DepositionDraft => draftSchema.parse({});

const emptyRun = (id: string): Run => ({ id, fileKeys: [] });

type Path = readonly PropertyKey[];

const isContainer = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === "object" && value !== null;

// Removes the value at `path`. When it is already absent (a missing required key) the parent is removed instead, so the
// loop in sanitizeDraft always makes progress.
const unset = (root: Record<PropertyKey, unknown>, path: Path): void => {
  if (path.length === 0) return;
  const parents: unknown[] = [root];
  for (const key of path.slice(0, -1)) {
    const next = isContainer(parents.at(-1)) ? (parents.at(-1) as Record<PropertyKey, unknown>)[key] : undefined;
    if (!isContainer(next)) return;
    parents.push(next);
  }
  const last = path.at(-1) as PropertyKey;
  const parent = parents.at(-1) as Record<PropertyKey, unknown>;
  if (last in parent) {
    if (Array.isArray(parent)) parent.splice(Number(last), 1);
    else delete parent[last];
    return;
  }
  if (path.length >= 2) unset(root, path.slice(0, -1));
};

// Keeps everything valid and drops the leaves that fail the lenient schema. Used before autosave (the server holds only
// valid data, the IndexedDB mirror keeps what the user typed) and when reading backend metadata that may carry values
// this app does not know.
const sanitizeDraft = (input: unknown): DepositionDraft => {
  const value: unknown = JSON.parse(JSON.stringify(input ?? {}));
  let current: Record<PropertyKey, unknown> = isContainer(value) && !Array.isArray(value) ? value : {};
  for (let attempt = 0; attempt < 8; attempt++) {
    const parsed = draftSchema.safeParse(current);
    if (parsed.success) return parsed.data;
    // Deepest and last-index paths first, so splicing one array item does not shift the next path.
    const paths = parsed.error.issues.map((issue) => issue.path).sort((a, b) => b.length - a.length || compareIndex(b, a));
    for (const path of paths) {
      if (path.length === 0) current = {};
      else unset(current, path);
    }
  }
  return emptyDraft();
};

const compareIndex = (a: Path, b: Path): number => {
  const left = Number(a.at(-1));
  const right = Number(b.at(-1));
  return Number.isNaN(left) || Number.isNaN(right) ? 0 : left - right;
};

export { emptyDraft, emptyRun, sanitizeDraft };
