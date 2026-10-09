import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const THEME_DIR = join("src", "shared", "ui", "theme");
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const EXTENSIONS = /\.(css|ts|tsx)$/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const offenders = walk(ROOT)
  .filter((file) => EXTENSIONS.test(file) && !relative(process.cwd(), file).startsWith(THEME_DIR))
  .flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) => (HEX.test(line) ? [`${relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`] : [])),
  );

if (offenders.length > 0) {
  console.error("Raw hex colours are only allowed under src/shared/ui/theme:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("check-colors: ok");
