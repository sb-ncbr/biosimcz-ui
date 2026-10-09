// One-off capture of MDposit payloads for MD-A007L3.1 into src/mocks/fixtures/mdposit (not run in CI).
// Run from mdrepo-new-ui/: npx tsx scripts/capture-mdposit-fixtures.ts
//
// Trimming rule (deterministic, shape-preserving, applied recursively to every JSON value):
//   1. A matrix (array whose every element is an array of primitives) keeps its first MATRIX_LIMIT rows,
//      and each kept row its first MATRIX_LIMIT cells.
//   2. Any other array keeps its first ARRAY_LIMIT items; objects inside are trimmed recursively.
//   3. Object keys, key order, strings and numbers are never changed or added.
// Original lengths are printed to stdout so shape findings can quote them.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const BASE_URL = "https://mdposit.mddbr.eu/api/rest/v1/projects";
const PROJECT_ID = "MD-A007L3.1";
const ARRAY_LIMIT = 200;
const MATRIX_LIMIT = 64;
const OPTION_BASES = ["clusters", "dist-perres", "energies", "hbonds", "rmsd-pairwise"];
// Probed in addition to the replica's own `analyses` list so missing names are recorded, not assumed.
const CANDIDATE_NAMES = [
  "rmsd", "rmsds", "rgyr", "fluctuation", "rmsd-perres", "dist-perres", "dist-perres-mean", "dist-perres-stdv",
  "energies", "hbonds", "interactions", "pca", "pockets", "mem-map", "apl", "density", "lipid-inter",
  "lipid-order", "thickness", "rmsd-pairwise", "rmsd-pairwise-interface", "sasa", "tmscores", "clusters",
];

const OUT = join(process.cwd(), "src", "mocks", "fixtures", "mdposit");

const isPrimitive = (value: Json): boolean => value === null || typeof value !== "object";
const isMatrix = (value: Json[]): value is Json[][] =>
  value.length > 0 && value.every((row) => Array.isArray(row) && row.every(isPrimitive));

const trim = (node: Json): Json => {
  if (Array.isArray(node)) {
    if (isMatrix(node)) return node.slice(0, MATRIX_LIMIT).map((row) => (row as Json[]).slice(0, MATRIX_LIMIT));
    return node.slice(0, ARRAY_LIMIT).map(trim);
  }
  if (typeof node === "object" && node !== null) {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, trim(value)]));
  }
  return node;
};

const fetchJson = async (url: string): Promise<{ status: number; body: Json | null }> => {
  const response = await fetch(url, { redirect: "follow", headers: { accept: "application/json" } });
  if (!response.ok) return { status: response.status, body: null };
  return { status: response.status, body: (await response.json()) as Json };
};

const write = (dir: string, name: string, body: Json): void => {
  const folder = join(OUT, dir);
  mkdirSync(folder, { recursive: true });
  const text = `${JSON.stringify(trim(body), null, 2)}\n`;
  writeFileSync(join(folder, `${name}.json`), text);
  console.log(`wrote ${dir}/${name}.json (${Math.round(text.length / 1024)} KB)`);
};

const main = async (): Promise<void> => {
  const replica = await fetchJson(`${BASE_URL}/${PROJECT_ID}`);
  if (replica.body === null) throw new Error(`replica fetch failed: ${replica.status}`);
  write("replica", PROJECT_ID, replica.body);

  const listed =
    typeof replica.body === "object" && !Array.isArray(replica.body) && Array.isArray(replica.body["analyses"])
      ? (replica.body["analyses"] as string[])
      : [];
  console.log(`replica.analyses (${listed.length}): ${listed.join(", ")}`);

  const optionNames = new Map<string, string[]>();
  for (const base of OPTION_BASES) {
    const result = await fetchJson(`${BASE_URL}/${PROJECT_ID}/analyses/${base}`);
    console.log(`options ${base}: HTTP ${result.status}`);
    if (result.body === null) continue;
    write("analysis-options", base, result.body);
    if (Array.isArray(result.body)) {
      optionNames.set(
        base,
        result.body.flatMap((item) =>
          typeof item === "object" && item !== null && !Array.isArray(item) && typeof item["analysis"] === "string"
            ? [item["analysis"]]
            : [],
        ),
      );
    }
  }

  const names = new Set<string>([...listed, ...[...optionNames.values()].flat()]);
  for (const base of CANDIDATE_NAMES) if (!OPTION_BASES.includes(base)) names.add(base);

  for (const name of [...names].sort()) {
    const result = await fetchJson(`${BASE_URL}/${PROJECT_ID}/analyses/${name}`);
    if (result.body === null) {
      console.log(`analysis ${name}: HTTP ${result.status} (not written)`);
      continue;
    }
    const shape = Array.isArray(result.body) ? `array(${result.body.length})` : "object";
    console.log(`analysis ${name}: HTTP ${result.status} ${shape}`);
    write("analyses", name, result.body);
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
