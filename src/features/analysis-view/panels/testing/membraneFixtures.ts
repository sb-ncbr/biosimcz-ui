import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodType } from "zod";
import { parseWith } from "@/entities/analysis";

// Fixture-only: the six membrane analyses have no live payload yet (stage 7), so these are the synthetic ones.
const loadSynthetic = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "src/mocks/fixtures/mdposit/analyses/synthetic", `${name}.json`), "utf8"));

const parseSynthetic = <T>(schema: ZodType<T>, name: string): T => {
  const result = parseWith(schema, loadSynthetic(name));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

export { parseSynthetic };
